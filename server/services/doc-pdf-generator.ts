export function generateSystemDocumentationHTML(): string {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Documentação Tele&lt;M3D&gt; Pro - Sistema de Gestão Médica</title>
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.6; font-size: 11px; }
  .page-break { page-break-before: always; }
  h1 { font-size: 26px; color: #0f172a; margin-bottom: 8px; }
  h2 { font-size: 18px; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; margin: 20px 0 10px; }
  h3 { font-size: 14px; color: #1e3a5f; margin: 12px 0 6px; }
  h4 { font-size: 12px; color: #475569; margin: 8px 0 4px; }
  p { margin-bottom: 6px; }
  ul { padding-left: 18px; margin-bottom: 8px; }
  li { margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
  th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .cover { text-align: center; padding: 80px 40px; }
  .cover-title { font-size: 42px; color: #1e40af; font-weight: 800; margin-bottom: 10px; }
  .cover-subtitle { font-size: 18px; color: #64748b; margin-bottom: 30px; }
  .cover-date { font-size: 12px; color: #94a3b8; }
  .cover-version { display: inline-block; background: #1e40af; color: white; padding: 4px 16px; border-radius: 20px; font-size: 12px; margin-top: 20px; }
  .toc { margin: 20px 0; }
  .toc-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #cbd5e1; }
  .toc-item span:first-child { font-weight: 500; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-purple { background: #f3e8ff; color: #6b21a8; }
  .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 14px; margin: 10px 0; border-radius: 0 6px 6px 0; }
  .warn-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; margin: 10px 0; border-radius: 0 6px 6px 0; }
  .diagram { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 12px 0; text-align: center; }
  .diagram svg { max-width: 100%; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
  .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 8px 0; }
  .card-header { font-weight: 700; color: #1e40af; margin-bottom: 6px; font-size: 12px; }
  .code { font-family: 'Courier New', monospace; background: #1e293b; color: #e2e8f0; padding: 10px; border-radius: 6px; font-size: 10px; white-space: pre; overflow-x: auto; margin: 8px 0; }
  .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  @media print {
    .no-print { display: none; }
    body { font-size: 10px; }
  }
</style>
</head>
<body>

<!-- CAPA -->
<div class="cover">
  <div style="margin-bottom:40px">
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="55" fill="#1e40af" opacity="0.1"/>
      <circle cx="60" cy="60" r="40" fill="#1e40af" opacity="0.2"/>
      <circle cx="60" cy="60" r="25" fill="#1e40af" opacity="0.3"/>
      <text x="60" y="55" text-anchor="middle" fill="#1e40af" font-size="14" font-weight="800">Tele</text>
      <text x="60" y="72" text-anchor="middle" fill="#1e40af" font-size="16" font-weight="800">&lt;M3D&gt;</text>
    </svg>
  </div>
  <div class="cover-title">Tele&lt;M3D&gt; Pro</div>
  <div class="cover-subtitle">Sistema de Gestão Médica e Telemedicina</div>
  <p style="font-size:14px;color:#475569;margin-bottom:20px">Documentação Completa do Sistema</p>
  <div class="cover-version">Versão 3.0</div>
  <p class="cover-date" style="margin-top:40px">${today}</p>
  <p style="font-size:10px;color:#94a3b8;margin-top:10px">Cybermedicina Ltda. — Todos os direitos reservados</p>
</div>

<!-- SUMÁRIO -->
<div class="page-break">
<h1>Sumário</h1>
<div class="toc">
  <div class="toc-item"><span>1. Visão Geral do Sistema</span><span>3</span></div>
  <div class="toc-item"><span>2. Arquitetura Técnica</span><span>4</span></div>
  <div class="toc-item"><span>3. Diagrama de Módulos</span><span>5</span></div>
  <div class="toc-item"><span>4. Guia do Paciente</span><span>6</span></div>
  <div class="toc-item"><span>5. Guia do Médico</span><span>8</span></div>
  <div class="toc-item"><span>6. Guia do Administrador</span><span>10</span></div>
  <div class="toc-item"><span>7. Assistente de Voz IAM3D</span><span>12</span></div>
  <div class="toc-item"><span>8. Sistema de Créditos e Carteira Digital</span><span>13</span></div>
  <div class="toc-item"><span>9. NFTs e Broker Interno</span><span>14</span></div>
  <div class="toc-item"><span>10. Segurança e LGPD</span><span>15</span></div>
  <div class="toc-item"><span>11. Estrutura do Banco de Dados</span><span>16</span></div>
  <div class="toc-item"><span>12. API Endpoints</span><span>17</span></div>
  <div class="toc-item"><span>13. Instalação e Configuração</span><span>18</span></div>
  <div class="toc-item"><span>14. Exportação de Dados do Paciente (HL7 FHIR R4)</span><span>20</span></div>
  <div class="toc-item"><span>15. Detecção de Inatividade e Auto-Logout</span><span>22</span></div>
</div>
</div>

<!-- 1. VISÃO GERAL -->
<div class="page-break">
<h2>1. Visão Geral do Sistema</h2>
<p>O <strong>Tele&lt;M3D&gt; Pro</strong> é uma plataforma completa de gestão médica e telemedicina que integra inteligência artificial, videoconsultas, gestão financeira com blockchain e conformidade com padrões internacionais de saúde.</p>

<h3>Principais Funcionalidades</h3>
<div class="two-col">
  <div class="card">
    <div class="card-header">🏥 Consultas e Atendimento</div>
    <ul>
      <li>Videoconsultas HD via Agora.io</li>
      <li>Agendamento inteligente com IA</li>
      <li>Plantão 24h com chamadas urgentes</li>
      <li>Sala de espera com triagem automática</li>
      <li>Código QR e código curto para acesso</li>
      <li>Convite de especialistas durante consulta</li>
      <li>Solicitação de consulta (2 caminhos: especialidade ou triagem IA)</li>
      <li>Agenda do médico em 3 abas (Hoje, Futuro, Histórico)</li>
      <li>Limpar agenda e cancelamento em massa</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-header">🤖 Inteligência Artificial</div>
    <ul>
      <li>Chatbot médico (Google Gemini)</li>
      <li>Assistente de voz IAM3D (full-screen, esfera animada, badges por papel)</li>
      <li>Triagem pelo Protocolo de Manchester (5 níveis)</li>
      <li>Diagnóstico diferencial assistido</li>
      <li>Relatórios epidemiológicos com IA (MeSH/ICD)</li>
      <li>Classificação diagnóstica pós-consulta (CID-10/11, DSM-5/TR)</li>
      <li>IAM3D: chamadas urgentes, médicos de plantão</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-header">📋 Gestão Clínica</div>
    <ul>
      <li>Prontuário eletrônico completo</li>
      <li>Prescrições digitais com PDF e assinatura digital</li>
      <li>Notas médicas estilo macOS Notes (pastas, fixação, cores)</li>
      <li>Classificação diagnóstica CID-10/11, DSM-5/TR</li>
      <li>Fluxo pós-consulta com IA (prescrições, exames, encaminhamentos, follow-up)</li>
      <li>Análise de interações medicamentosas</li>
      <li>Exportação de dados do paciente (HL7 FHIR R4)</li>
      <li>Interconsultas médicas e equipes de discussão</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-header">💰 Sistema Financeiro</div>
    <ul>
      <li>Créditos TMC com taxa configurável</li>
      <li>Checkout via PayPal (6 pacotes, 15 custos de funcionalidades)</li>
      <li>Carteira digital com auditoria completa</li>
      <li>NFTs de dados médicos (LGPD)</li>
      <li>Broker interno para TM3D/NFTs (order book, histórico)</li>
      <li>Carteiras externas (MetaMask/WalletConnect)</li>
      <li>Solicitação de saque</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-header">🔒 Segurança e Conformidade</div>
    <ul>
      <li>Detecção de inatividade e auto-logout configurável</li>
      <li>Exportação FHIR R4 (Brasil/SUS, USA/HIPAA, EU/GDPR, Internacional)</li>
      <li>Desidentificação HIPAA de dados exportados</li>
      <li>Dashboard de relatórios (consultas, pacientes, financeiro, performance)</li>
    </ul>
  </div>
</div>

<h3>Padrões e Protocolos de Referência</h3>
<table>
  <tr><th>Referência</th><th>Aplicação</th></tr>
  <tr><td>OMS (Organização Mundial da Saúde)</td><td>Diretrizes clínicas, GINA, GOLD, ETAT, mhGAP</td></tr>
  <tr><td>Ministério da Saúde / Brasil</td><td>Cadernos de Atenção Básica, PCDT/CONITEC, PNAB, RENAME</td></tr>
  <tr><td>DSM-5 / DSM-5-TR (APA)</td><td>Critérios diagnósticos para transtornos mentais</td></tr>
  <tr><td>Protocolo de Manchester</td><td>Classificação de risco em 5 níveis com cores</td></tr>
  <tr><td>LGPD (Lei 13.709/2018)</td><td>Proteção de dados pessoais e médicos</td></tr>
  <tr><td>HL7 FHIR R4</td><td>Interoperabilidade e exportação de dados clínicos</td></tr>
  <tr><td>HIPAA</td><td>Conformidade e desidentificação de dados (USA)</td></tr>
  <tr><td>GDPR</td><td>Proteção de dados e direitos do titular (EU)</td></tr>
  <tr><td>ICD-10/11, SNOMED CT</td><td>Codificação diagnóstica e terminologia clínica internacional</td></tr>
</table>
</div>

<!-- 2. ARQUITETURA TÉCNICA -->
<div class="page-break">
<h2>2. Arquitetura Técnica</h2>
<p>O sistema utiliza uma arquitetura full-stack moderna com separação clara entre frontend, backend e serviços.</p>

<div class="diagram">
<svg width="680" height="320" viewBox="0 0 680 320">
  <!-- Frontend -->
  <rect x="10" y="10" width="200" height="130" rx="8" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
  <text x="110" y="35" text-anchor="middle" font-weight="700" fill="#1e40af" font-size="13">Frontend (React)</text>
  <text x="110" y="55" text-anchor="middle" font-size="10" fill="#475569">React 18 + TypeScript</text>
  <text x="110" y="70" text-anchor="middle" font-size="10" fill="#475569">Tailwind CSS + shadcn/ui</text>
  <text x="110" y="85" text-anchor="middle" font-size="10" fill="#475569">TanStack Query v5</text>
  <text x="110" y="100" text-anchor="middle" font-size="10" fill="#475569">Wouter (Router)</text>
  <text x="110" y="115" text-anchor="middle" font-size="10" fill="#475569">Recharts (Analytics)</text>
  <text x="110" y="130" text-anchor="middle" font-size="10" fill="#475569">Web Speech API (IAM3D)</text>

  <!-- Backend -->
  <rect x="240" y="10" width="200" height="130" rx="8" fill="#dcfce7" stroke="#22c55e" stroke-width="2"/>
  <text x="340" y="35" text-anchor="middle" font-weight="700" fill="#166534" font-size="13">Backend (Node.js)</text>
  <text x="340" y="55" text-anchor="middle" font-size="10" fill="#475569">Express.js</text>
  <text x="340" y="70" text-anchor="middle" font-size="10" fill="#475569">Drizzle ORM</text>
  <text x="340" y="85" text-anchor="middle" font-size="10" fill="#475569">Passport.js (Auth)</text>
  <text x="340" y="100" text-anchor="middle" font-size="10" fill="#475569">WebSocket (Real-time)</text>
  <text x="340" y="115" text-anchor="middle" font-size="10" fill="#475569">PDF Generator</text>
  <text x="340" y="130" text-anchor="middle" font-size="10" fill="#475569">Cron (Agendamento)</text>

  <!-- Services -->
  <rect x="470" y="10" width="200" height="130" rx="8" fill="#f3e8ff" stroke="#a855f7" stroke-width="2"/>
  <text x="570" y="35" text-anchor="middle" font-weight="700" fill="#6b21a8" font-size="13">Serviços Externos</text>
  <text x="570" y="55" text-anchor="middle" font-size="10" fill="#475569">Google Gemini 2.0 Flash</text>
  <text x="570" y="70" text-anchor="middle" font-size="10" fill="#475569">OpenAI GPT-4o-mini (fallback)</text>
  <text x="570" y="85" text-anchor="middle" font-size="10" fill="#475569">Agora.io (Vídeo/RTC)</text>
  <text x="570" y="100" text-anchor="middle" font-size="10" fill="#475569">PayPal (Pagamentos)</text>
  <text x="570" y="115" text-anchor="middle" font-size="10" fill="#475569">Web Speech API (Voz)</text>
  <text x="570" y="130" text-anchor="middle" font-size="10" fill="#475569">MetaMask/WalletConnect</text>

  <!-- Database -->
  <rect x="240" y="200" width="200" height="100" rx="8" fill="#fef3c7" stroke="#f59e0b" stroke-width="2"/>
  <text x="340" y="225" text-anchor="middle" font-weight="700" fill="#92400e" font-size="13">Banco de Dados</text>
  <text x="340" y="245" text-anchor="middle" font-size="10" fill="#475569">PostgreSQL (Neon)</text>
  <text x="340" y="260" text-anchor="middle" font-size="10" fill="#475569">61 tabelas</text>
  <text x="340" y="275" text-anchor="middle" font-size="10" fill="#475569">Drizzle Migrations</text>
  <text x="340" y="290" text-anchor="middle" font-size="10" fill="#475569">JSONB para dados flexíveis</text>

  <!-- Arrows -->
  <line x1="210" y1="75" x2="240" y2="75" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="440" y1="75" x2="470" y2="75" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="340" y1="140" x2="340" y2="200" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)"/>

  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#64748b"/>
    </marker>
  </defs>
</svg>
</div>

<h3>Stack Tecnológico</h3>
<table>
  <tr><th>Camada</th><th>Tecnologia</th><th>Finalidade</th></tr>
  <tr><td>Frontend</td><td>React 18 + TypeScript</td><td>Interface do usuário</td></tr>
  <tr><td>Estilização</td><td>Tailwind CSS + shadcn/ui</td><td>Design system</td></tr>
  <tr><td>Backend</td><td>Express.js + TypeScript</td><td>API REST e WebSocket</td></tr>
  <tr><td>ORM</td><td>Drizzle ORM</td><td>Acesso ao banco de dados</td></tr>
  <tr><td>Banco de Dados</td><td>PostgreSQL (Neon)</td><td>Persistência de dados</td></tr>
  <tr><td>IA Principal</td><td>Google Gemini 2.0 Flash</td><td>Chatbot, triagem, diagnóstico</td></tr>
  <tr><td>IA Fallback</td><td>OpenAI GPT-4o-mini</td><td>Backup para serviços IA</td></tr>
  <tr><td>Vídeo</td><td>Agora.io SDK</td><td>Videoconsultas em tempo real</td></tr>
  <tr><td>Pagamento</td><td>PayPal REST API</td><td>Checkout para créditos TMC</td></tr>
  <tr><td>Voz</td><td>Web Speech API</td><td>STT/TTS para IAM3D</td></tr>
  <tr><td>Exportação</td><td>HL7 FHIR R4</td><td>Exportação de dados clínicos multi-padrão</td></tr>
</table>
</div>

<!-- 3. DIAGRAMA DE MÓDULOS -->
<div class="page-break">
<h2>3. Diagrama de Módulos e Relacionamentos</h2>
<p>Os módulos do sistema estão organizados em grupos funcionais interconectados:</p>

<div class="diagram">
<svg width="680" height="500" viewBox="0 0 680 500">
  <!-- Central: Users -->
  <rect x="270" y="10" width="140" height="50" rx="8" fill="#1e40af" stroke="#1e3a8a" stroke-width="2"/>
  <text x="340" y="40" text-anchor="middle" fill="white" font-weight="700" font-size="12">Usuários (RBAC)</text>

  <!-- Row 1: Clinical -->
  <rect x="10" y="100" width="130" height="45" rx="6" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="75" y="127" text-anchor="middle" font-size="10" fill="#1e40af" font-weight="600">Agendamento</text>
  <rect x="155" y="100" width="130" height="45" rx="6" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="220" y="127" text-anchor="middle" font-size="10" fill="#1e40af" font-weight="600">Videoconsultas</text>
  <rect x="300" y="100" width="130" height="45" rx="6" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="365" y="127" text-anchor="middle" font-size="10" fill="#1e40af" font-weight="600">Prontuários</text>
  <rect x="445" y="100" width="130" height="45" rx="6" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="510" y="127" text-anchor="middle" font-size="10" fill="#1e40af" font-weight="600">Prescrições</text>

  <!-- Row 2: AI -->
  <rect x="10" y="180" width="130" height="45" rx="6" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="75" y="200" text-anchor="middle" font-size="10" fill="#6b21a8" font-weight="600">Chatbot IA</text>
  <text x="75" y="215" text-anchor="middle" font-size="8" fill="#7c3aed">(Gemini)</text>
  <rect x="155" y="180" width="130" height="45" rx="6" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="220" y="200" text-anchor="middle" font-size="10" fill="#6b21a8" font-weight="600">IAM3D Voz</text>
  <text x="220" y="215" text-anchor="middle" font-size="8" fill="#7c3aed">(Web Speech)</text>
  <rect x="300" y="180" width="130" height="45" rx="6" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="365" y="200" text-anchor="middle" font-size="10" fill="#6b21a8" font-weight="600">Triagem</text>
  <text x="365" y="215" text-anchor="middle" font-size="8" fill="#7c3aed">(Manchester)</text>
  <rect x="445" y="180" width="130" height="45" rx="6" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="510" y="200" text-anchor="middle" font-size="10" fill="#6b21a8" font-weight="600">Diagnóstico IA</text>
  <text x="510" y="215" text-anchor="middle" font-size="8" fill="#7c3aed">(CID-10, DSM-5)</text>

  <!-- Row 3: Communication -->
  <rect x="10" y="260" width="130" height="45" rx="6" fill="#ffedd5" stroke="#f97316"/>
  <text x="75" y="287" text-anchor="middle" font-size="10" fill="#c2410c" font-weight="600">WhatsApp IA</text>
  <rect x="155" y="260" width="130" height="45" rx="6" fill="#ffedd5" stroke="#f97316"/>
  <text x="220" y="287" text-anchor="middle" font-size="10" fill="#c2410c" font-weight="600">Notificações</text>
  <rect x="300" y="260" width="130" height="45" rx="6" fill="#ffedd5" stroke="#f97316"/>
  <text x="365" y="287" text-anchor="middle" font-size="10" fill="#c2410c" font-weight="600">Equipes Médicas</text>
  <rect x="445" y="260" width="130" height="45" rx="6" fill="#ffedd5" stroke="#f97316"/>
  <text x="510" y="287" text-anchor="middle" font-size="10" fill="#c2410c" font-weight="600">Interconsultas</text>

  <!-- Row 4: Financial -->
  <rect x="10" y="340" width="130" height="45" rx="6" fill="#fef3c7" stroke="#eab308"/>
  <text x="75" y="367" text-anchor="middle" font-size="10" fill="#a16207" font-weight="600">Carteira TMC</text>
  <rect x="155" y="340" width="130" height="45" rx="6" fill="#fef3c7" stroke="#eab308"/>
  <text x="220" y="367" text-anchor="middle" font-size="10" fill="#a16207" font-weight="600">PayPal Checkout</text>
  <rect x="300" y="340" width="130" height="45" rx="6" fill="#fef3c7" stroke="#eab308"/>
  <text x="365" y="367" text-anchor="middle" font-size="10" fill="#a16207" font-weight="600">NFTs Médicos</text>
  <rect x="445" y="340" width="130" height="45" rx="6" fill="#fef3c7" stroke="#eab308"/>
  <text x="510" y="367" text-anchor="middle" font-size="10" fill="#a16207" font-weight="600">Broker TM3D</text>

  <!-- Row 5: Admin -->
  <rect x="80" y="420" width="140" height="45" rx="6" fill="#fee2e2" stroke="#ef4444"/>
  <text x="150" y="447" text-anchor="middle" font-size="10" fill="#991b1b" font-weight="600">Admin / Config</text>
  <rect x="240" y="420" width="140" height="45" rx="6" fill="#fee2e2" stroke="#ef4444"/>
  <text x="310" y="447" text-anchor="middle" font-size="10" fill="#991b1b" font-weight="600">Relatórios</text>
  <rect x="400" y="420" width="140" height="45" rx="6" fill="#fee2e2" stroke="#ef4444"/>
  <text x="470" y="447" text-anchor="middle" font-size="10" fill="#991b1b" font-weight="600">Auditoria</text>

  <!-- Connecting lines -->
  <line x1="340" y1="60" x2="75" y2="100" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4"/>
  <line x1="340" y1="60" x2="220" y2="100" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4"/>
  <line x1="340" y1="60" x2="365" y2="100" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4"/>
  <line x1="340" y1="60" x2="510" y2="100" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4"/>
  <line x1="75" y1="145" x2="75" y2="180" stroke="#94a3b8" stroke-width="1"/>
  <line x1="220" y1="145" x2="220" y2="180" stroke="#94a3b8" stroke-width="1"/>
  <line x1="365" y1="145" x2="365" y2="180" stroke="#94a3b8" stroke-width="1"/>
  <line x1="510" y1="145" x2="510" y2="180" stroke="#94a3b8" stroke-width="1"/>
  <line x1="75" y1="225" x2="75" y2="260" stroke="#94a3b8" stroke-width="1"/>
  <line x1="220" y1="225" x2="220" y2="260" stroke="#94a3b8" stroke-width="1"/>
  <line x1="365" y1="225" x2="365" y2="260" stroke="#94a3b8" stroke-width="1"/>
  <line x1="510" y1="225" x2="510" y2="260" stroke="#94a3b8" stroke-width="1"/>
  <line x1="75" y1="305" x2="75" y2="340" stroke="#94a3b8" stroke-width="1"/>
  <line x1="220" y1="305" x2="220" y2="340" stroke="#94a3b8" stroke-width="1"/>
  <line x1="365" y1="305" x2="365" y2="340" stroke="#94a3b8" stroke-width="1"/>
  <line x1="510" y1="305" x2="510" y2="340" stroke="#94a3b8" stroke-width="1"/>

  <!-- Legend -->
  <rect x="580" y="100" width="10" height="10" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="595" y="110" font-size="9" fill="#475569">Clínico</text>
  <rect x="580" y="118" width="10" height="10" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="595" y="128" font-size="9" fill="#475569">IA</text>
  <rect x="580" y="136" width="10" height="10" fill="#ffedd5" stroke="#f97316"/>
  <text x="595" y="146" font-size="9" fill="#475569">Comunicação</text>
  <rect x="580" y="154" width="10" height="10" fill="#fef3c7" stroke="#eab308"/>
  <text x="595" y="164" font-size="9" fill="#475569">Financeiro</text>
  <rect x="580" y="172" width="10" height="10" fill="#fee2e2" stroke="#ef4444"/>
  <text x="595" y="182" font-size="9" fill="#475569">Admin</text>
</svg>
</div>
</div>

<!-- 4. GUIA DO PACIENTE -->
<div class="page-break">
<h2>4. Guia do Paciente</h2>
<p>O paciente tem acesso a funcionalidades de autocuidado, agendamento e consultas.</p>

<h3>4.1 Dashboard do Paciente</h3>
<p>Ao fazer login, o paciente visualiza um painel com suas próximas consultas, status de solicitações, prescrições ativas e acesso ao assistente de voz IAM3D.</p>

<h3>4.2 Agendamento de Consultas</h3>
<p>Dois caminhos disponíveis:</p>
<ul>
  <li><strong>Buscar por Especialidade:</strong> Navega por médicos disponíveis e seleciona horário</li>
  <li><strong>Triagem por Sintomas (IA):</strong> Descreve sintomas ao chatbot/IAM3D que recomenda um médico adequado</li>
</ul>

<div class="diagram">
<svg width="600" height="160" viewBox="0 0 600 160">
  <rect x="10" y="50" width="110" height="60" rx="6" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="65" y="75" text-anchor="middle" font-size="10" fill="#1e40af" font-weight="600">Paciente</text>
  <text x="65" y="92" text-anchor="middle" font-size="9" fill="#475569">Descreve sintomas</text>

  <rect x="150" y="20" width="120" height="50" rx="6" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="210" y="42" text-anchor="middle" font-size="10" fill="#6b21a8" font-weight="600">IA Triagem</text>
  <text x="210" y="58" text-anchor="middle" font-size="9" fill="#475569">Manchester Protocol</text>

  <rect x="150" y="90" width="120" height="50" rx="6" fill="#dcfce7" stroke="#22c55e"/>
  <text x="210" y="112" text-anchor="middle" font-size="10" fill="#166534" font-weight="600">Buscar Médico</text>
  <text x="210" y="128" text-anchor="middle" font-size="9" fill="#475569">Por especialidade</text>

  <rect x="310" y="50" width="120" height="60" rx="6" fill="#fef3c7" stroke="#eab308"/>
  <text x="370" y="75" text-anchor="middle" font-size="10" fill="#a16207" font-weight="600">Horário</text>
  <text x="370" y="92" text-anchor="middle" font-size="9" fill="#475569">Seleciona slot</text>

  <rect x="470" y="50" width="120" height="60" rx="6" fill="#dcfce7" stroke="#22c55e"/>
  <text x="530" y="75" text-anchor="middle" font-size="10" fill="#166534" font-weight="600">Consulta</text>
  <text x="530" y="92" text-anchor="middle" font-size="9" fill="#475569">Confirmada ✓</text>

  <line x1="120" y1="65" x2="150" y2="45" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="120" y1="95" x2="150" y2="115" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="270" y1="45" x2="310" y2="70" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="270" y1="115" x2="310" y2="90" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="430" y1="80" x2="470" y2="80" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
</svg>
</div>

<h3>4.3 Consultas Urgentes</h3>
<p>Para emergências, o paciente pode solicitar atendimento urgente com médicos de plantão via:</p>
<ul>
  <li><strong>Assistente IAM3D:</strong> Diga "preciso de atendimento urgente" e o sistema localiza médicos de plantão</li>
  <li><strong>Chatbot:</strong> Escreva sobre seus sintomas urgentes e solicite atendimento imediato</li>
  <li><strong>Sala de Espera:</strong> Acesso direto a consultas imediatas com médicos online</li>
</ul>

<h3>4.4 Prescrições e Prontuário</h3>
<ul>
  <li>Visualizar prescrições ativas com download em PDF</li>
  <li>Acessar prontuário médico completo</li>
  <li>Upload de exames e resultados</li>
  <li>Histórico de consultas anteriores</li>
</ul>

<h3>4.5 Exportação de Dados (FHIR R4)</h3>
<p>Como direito garantido pela LGPD, o paciente pode exportar seus dados clínicos em formato HL7 FHIR R4:</p>
<ul>
  <li><strong>Brasil/SUS:</strong> Formato compatível com RNDS, RAC, SBIS, LGPD</li>
  <li><strong>USA:</strong> Formato HIPAA/USCDI v3</li>
  <li><strong>Europa:</strong> Formato GDPR</li>
  <li><strong>Internacional:</strong> ICD-11, SNOMED CT</li>
  <li><strong>Desidentificação:</strong> Opção de remoção de dados identificáveis (HIPAA Safe Harbor)</li>
</ul>

<h3>4.6 Detecção de Inatividade</h3>
<ul>
  <li>O sistema monitora inatividade do usuário (tempo configurável pelo admin)</li>
  <li>Ao atingir o limite, exibe prompt perguntando se deseja continuar</li>
  <li>Se não houver resposta, realiza auto-logout e desconecta do Agora.io</li>
  <li>Protege a segurança dos dados do paciente em terminais compartilhados</li>
</ul>

<h3>4.7 Créditos TMC</h3>
<ul>
  <li>Compra de créditos via PayPal</li>
  <li>6 pacotes disponíveis (Básico, Padrão, Profissional, Premium, Empresarial, Ilimitado)</li>
  <li>Saldo e histórico de transações na carteira digital</li>
</ul>
</div>

<!-- 5. GUIA DO MÉDICO -->
<div class="page-break">
<h2>5. Guia do Médico</h2>
<p>O médico dispõe de ferramentas avançadas para gestão clínica, atendimento e análise.</p>

<h3>5.1 Dashboard do Médico</h3>
<p>Painel com consultas do dia, pacientes em espera, notificações urgentes, e acesso rápido às funcionalidades.</p>

<h3>5.2 Gerenciar Disponibilidade e Agenda</h3>
<ul>
  <li><strong>Status Online:</strong> Toggle para marcar-se como disponível</li>
  <li><strong>Atendimento Imediato:</strong> Habilitar recebimento de consultas emergenciais</li>
  <li><strong>Plantão 24h:</strong> Ativar plantão que mantém disponibilidade automática por 24 horas</li>
  <li><strong>Chamadas IAM3D:</strong> Quando em plantão, recebe solicitações urgentes do assistente de voz</li>
  <li><strong>Agenda Semanal:</strong> Definir horários de atendimento (manhã/tarde) por dia da semana</li>
</ul>

<h4>Agenda em 3 Abas</h4>
<ul>
  <li><strong>Hoje:</strong> Consultas do dia atual com status em tempo real</li>
  <li><strong>Futuro:</strong> Consultas agendadas para os próximos dias</li>
  <li><strong>Histórico:</strong> Consultas passadas com detalhes e resultados</li>
</ul>

<h4>Ações de Agenda</h4>
<ul>
  <li><strong>Cancelamento em Massa:</strong> Selecionar e cancelar múltiplas consultas de uma vez</li>
  <li><strong>Limpar Agenda:</strong> Cancelar todas as consultas futuras com um clique</li>
</ul>

<h3>5.3 Videoconsulta</h3>

<div class="diagram">
<svg width="600" height="140" viewBox="0 0 600 140">
  <rect x="10" y="40" width="90" height="55" rx="6" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="55" y="60" text-anchor="middle" font-size="9" fill="#1e40af" font-weight="600">Iniciar</text>
  <text x="55" y="75" text-anchor="middle" font-size="8" fill="#475569">Agora.io</text>

  <rect x="120" y="40" width="90" height="55" rx="6" fill="#dcfce7" stroke="#22c55e"/>
  <text x="165" y="60" text-anchor="middle" font-size="9" fill="#166534" font-weight="600">Consulta</text>
  <text x="165" y="75" text-anchor="middle" font-size="8" fill="#475569">Vídeo+Chat+IA</text>

  <rect x="230" y="40" width="90" height="55" rx="6" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="275" y="60" text-anchor="middle" font-size="9" fill="#6b21a8" font-weight="600">Transcrição</text>
  <text x="275" y="75" text-anchor="middle" font-size="8" fill="#475569">Tempo real</text>

  <rect x="340" y="40" width="90" height="55" rx="6" fill="#fef3c7" stroke="#eab308"/>
  <text x="385" y="60" text-anchor="middle" font-size="9" fill="#a16207" font-weight="600">Encerrar</text>
  <text x="385" y="75" text-anchor="middle" font-size="8" fill="#475569">Gera SOAP</text>

  <rect x="450" y="15" width="90" height="45" rx="6" fill="#fee2e2" stroke="#ef4444"/>
  <text x="495" y="35" text-anchor="middle" font-size="9" fill="#991b1b" font-weight="600">Prescrição</text>
  <text x="495" y="50" text-anchor="middle" font-size="8" fill="#475569">Auto IA</text>

  <rect x="450" y="75" width="90" height="45" rx="6" fill="#fee2e2" stroke="#ef4444"/>
  <text x="495" y="95" text-anchor="middle" font-size="9" fill="#991b1b" font-weight="600">Diagnóstico</text>
  <text x="495" y="110" text-anchor="middle" font-size="8" fill="#475569">CID-10/DSM-5</text>

  <line x1="100" y1="67" x2="120" y2="67" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="210" y1="67" x2="230" y2="67" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="320" y1="67" x2="340" y2="67" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="430" y1="55" x2="450" y2="37" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="430" y1="75" x2="450" y2="90" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
</svg>
</div>

<h3>5.4 Assistente IA para Médicos</h3>
<ul>
  <li>Verificação de hipóteses diagnósticas e diagnóstico diferencial</li>
  <li>Consulta a guidelines (OMS, MS/Brasil, DSM-5)</li>
  <li>Análise de interações medicamentosas</li>
  <li>Sugestão de exames complementares</li>
  <li>Referências de PDFs médicos (RAG)</li>
</ul>

<h3>5.5 Notas Médicas</h3>
<p>Interface estilo macOS Notes com pastas, busca, fixação de notas, etiquetas coloridas e auto-save.</p>

<h3>5.6 Fluxo Pós-Consulta</h3>
<p>Após encerrar a videoconsulta, a IA gera automaticamente os itens pós-consulta para revisão do médico:</p>
<ul>
  <li><strong>Prescrições:</strong> Medicamentos sugeridos com posologia baseada na transcrição</li>
  <li><strong>Exames:</strong> Exames complementares recomendados</li>
  <li><strong>Encaminhamentos:</strong> Referências para especialistas quando necessário</li>
  <li><strong>Follow-up:</strong> Orientações de acompanhamento para o paciente</li>
  <li><strong>Interações Medicamentosas:</strong> Análise automática de conflitos antes da prescrição</li>
</ul>

<h4>Classificação Diagnóstica</h4>
<ul>
  <li><strong>CID-10/11:</strong> Código de classificação internacional de doenças</li>
  <li><strong>DSM-5/TR:</strong> Critérios diagnósticos para transtornos mentais</li>
  <li><strong>Nível de Confiança:</strong> Percentual de certeza do diagnóstico</li>
  <li>Médico revisa, ajusta e autoriza antes de liberar ao paciente</li>
</ul>

<h3>5.7 Interconsultas</h3>
<ul>
  <li>Agendar interconsultas com outros médicos especialistas</li>
  <li>IAM3D pode solicitar interconsulta durante videoconsulta</li>
  <li>Compartilhamento de dados clínicos relevantes entre médicos</li>
</ul>

<h3>5.8 Consultas Incompletas</h3>
<ul>
  <li>Dashboard de consultas que não foram finalizadas corretamente</li>
  <li>Permite retomar fluxo pós-consulta de sessões anteriores</li>
  <li>Garante que nenhum atendimento fique sem documentação</li>
</ul>

<h3>5.9 Exportação de Dados do Paciente (FHIR)</h3>
<ul>
  <li>Exportar dados de pacientes em formato HL7 FHIR R4</li>
  <li>Suporte a múltiplos padrões: Brasil/SUS, USA/HIPAA, EU/GDPR, Internacional</li>
  <li>Opção de desidentificação (HIPAA Safe Harbor)</li>
</ul>

<h3>5.10 Dashboard de Relatórios</h3>
<ul>
  <li>Resumo de consultas realizadas por período</li>
  <li>Performance individual e estatísticas de atendimento</li>
  <li>Relatórios epidemiológicos com análise IA</li>
  <li>Exportação de dados em CSV</li>
</ul>
</div>

<!-- 6. GUIA DO ADMINISTRADOR -->
<div class="page-break">
<h2>6. Guia do Administrador</h2>

<h3>6.1 Painel Administrativo</h3>
<p>Interface com tema escuro (indigo/slate) diferenciado. Gerencia usuários, configurações e financeiro.</p>

<h3>6.2 Gestão de Usuários</h3>
<ul>
  <li>Criar, editar, ativar/desativar contas (médicos, pacientes, admins)</li>
  <li>Verificação e aprovação de licenças médicas</li>
  <li>Gestão de links de acesso temporário para visitantes</li>
</ul>

<h3>6.3 Gestão Financeira</h3>
<ul>
  <li><strong>Pacotes de Crédito:</strong> CRUD completo (criar, editar, ativar/desativar, promoções)</li>
  <li><strong>Custos de Funcionalidades:</strong> 15 custos configuráveis para recursos do sistema</li>
  <li><strong>Taxa de Câmbio:</strong> Configurar relação TMC/USD (padrão: 1 USD = 5 TMC)</li>
  <li><strong>Envio de Créditos:</strong> Adicionar créditos diretamente a contas de usuários</li>
  <li><strong>Auditoria:</strong> Log completo de transações financeiras com filtros</li>
</ul>

<h3>6.4 Configurações do Sistema</h3>
<table>
  <tr><th>Configuração</th><th>Descrição</th><th>Padrão</th></tr>
  <tr><td>Expiração link temporário</td><td>Validade de links de acesso para visitantes</td><td>24h</td></tr>
  <tr><td>Token consulta</td><td>Validade de tokens de acesso à consulta</td><td>2h</td></tr>
  <tr><td>Triagem IA</td><td>Habilitar/desabilitar triagem automática</td><td>Ativada</td></tr>
  <tr><td>Taxa câmbio TMC</td><td>Relação USD para TMC</td><td>5.00</td></tr>
  <tr><td>Margem reagendamento</td><td>Horas mínimas antes de poder reagendar</td><td>24h</td></tr>
  <tr><td>Timeout de inatividade</td><td>Tempo em minutos antes do auto-logout por inatividade</td><td>30 min</td></tr>
  <tr><td>E-mail PayPal destinatário</td><td>E-mail para recebimento de pagamentos PayPal</td><td>Configurável</td></tr>
  <tr><td>Configurações financeiras</td><td>Parâmetros gerais do módulo financeiro</td><td>Configurável</td></tr>
</table>

<h3>6.5 Dashboard de Relatórios</h3>
<ul>
  <li>Resumo de consultas (por status, tipo, período)</li>
  <li>Demografia de pacientes</li>
  <li>Resumo financeiro (fluxo de créditos, receitas, despesas)</li>
  <li>Performance de médicos (consultas realizadas, avaliações)</li>
  <li>Relatórios epidemiológicos com IA (MeSH, ICD)</li>
  <li>Exportação em CSV</li>
  <li>Conformidade FHIR R4 para dados exportados</li>
</ul>

<h3>6.6 Gestão Financeira Avançada</h3>
<ul>
  <li><strong>Pacotes de Crédito:</strong> CRUD completo com ativação/desativação e promoções</li>
  <li><strong>Custos de Funcionalidades:</strong> 15 custos configuráveis (consulta, prescrição, etc.)</li>
  <li><strong>Taxa de Câmbio:</strong> TMC/USD com atualização em tempo real</li>
  <li><strong>Envio de Créditos:</strong> Adicionar créditos diretamente a contas de usuários</li>
  <li><strong>Log de Auditoria:</strong> Histórico completo de transações com filtros por ação e resumos semanais</li>
</ul>
</div>

<!-- 7. ASSISTENTE DE VOZ IAM3D -->
<div class="page-break">
<h2>7. Assistente de Voz IAM3D</h2>
<p>O <strong>IAM3D</strong> (pronuncia-se "ia méd") é o assistente médico virtual de voz da plataforma, com interface full-screen e esfera animada.</p>

<h3>7.1 Ativação</h3>
<ul>
  <li>Na primeira visita, um prompt pergunta se o usuário deseja ativar o assistente de voz</li>
  <li>Após decidir, um ícone aparece na barra de navegação superior</li>
  <li>Ícone cinza = desativado; ícone azul com indicador verde = ativado</li>
  <li>Pode ser ativado/desativado a qualquer momento</li>
</ul>

<h3>7.2 Funcionalidades por Perfil</h3>
<div class="two-col">
  <div class="card">
    <div class="card-header">Paciente <span class="badge badge-blue">Triagem</span> <span class="badge badge-green">Agendar</span> <span class="badge badge-red">Urgente</span></div>
    <ul>
      <li>Triagem de sintomas (Manchester)</li>
      <li>Agendamento de consultas por voz</li>
      <li>Solicitação de consulta urgente com plantão</li>
      <li>Orientações gerais de saúde</li>
      <li>Navegação para perfil e prescrições</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-header">Médico <span class="badge badge-purple">Diagnóstico</span> <span class="badge badge-blue">Protocolos</span> <span class="badge badge-amber">Plantão</span></div>
    <ul>
      <li>Suporte diagnóstico diferencial</li>
      <li>Consulta a protocolos (OMS, DSM-5)</li>
      <li>Análise de interações medicamentosas</li>
      <li>Sugestões de exames</li>
      <li>Referências de guidelines</li>
    </ul>
  </div>
</div>

<h3>7.3 Comandos de Voz</h3>
<table>
  <tr><th>Comando</th><th>Ação</th></tr>
  <tr><td>"fechar assistente" / "encerrar assistente"</td><td>Fecha o IAM3D</td></tr>
  <tr><td>"preciso de atendimento urgente"</td><td>Solicita consulta com médico de plantão</td></tr>
  <tr><td>"quero agendar uma consulta"</td><td>Inicia fluxo de agendamento</td></tr>
  <tr><td>"desligar assistente" / "sair do assistente"</td><td>Fecha o IAM3D</td></tr>
</table>

<h3>7.4 Fluxo de Consulta Urgente via IAM3D</h3>
<div class="diagram">
<svg width="600" height="120" viewBox="0 0 600 120">
  <rect x="10" y="30" width="100" height="55" rx="6" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="60" y="52" text-anchor="middle" font-size="9" fill="#6b21a8" font-weight="600">Paciente fala</text>
  <text x="60" y="67" text-anchor="middle" font-size="8" fill="#475569">"urgente"</text>

  <rect x="130" y="30" width="100" height="55" rx="6" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="180" y="52" text-anchor="middle" font-size="9" fill="#1e40af" font-weight="600">IA detecta</text>
  <text x="180" y="67" text-anchor="middle" font-size="8" fill="#475569">[URGENT]</text>

  <rect x="250" y="30" width="100" height="55" rx="6" fill="#fef3c7" stroke="#eab308"/>
  <text x="300" y="52" text-anchor="middle" font-size="9" fill="#a16207" font-weight="600">Botão ação</text>
  <text x="300" y="67" text-anchor="middle" font-size="8" fill="#475569">Confirma</text>

  <rect x="370" y="30" width="100" height="55" rx="6" fill="#dcfce7" stroke="#22c55e"/>
  <text x="420" y="52" text-anchor="middle" font-size="9" fill="#166534" font-weight="600">Busca plantão</text>
  <text x="420" y="67" text-anchor="middle" font-size="8" fill="#475569">Médicos online</text>

  <rect x="490" y="30" width="100" height="55" rx="6" fill="#fee2e2" stroke="#ef4444"/>
  <text x="540" y="52" text-anchor="middle" font-size="9" fill="#991b1b" font-weight="600">Notifica</text>
  <text x="540" y="67" text-anchor="middle" font-size="8" fill="#475569">Médico alertado</text>

  <line x1="110" y1="57" x2="130" y2="57" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="230" y1="57" x2="250" y2="57" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="350" y1="57" x2="370" y2="57" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="470" y1="57" x2="490" y2="57" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
</svg>
</div>

<h3>7.5 IAM3D e Médicos de Plantão</h3>
<p>O IAM3D integra-se ao sistema de plantão para emergências:</p>
<ul>
  <li><strong>Chamadas Urgentes:</strong> Quando o paciente solicita atendimento urgente, o IAM3D busca automaticamente médicos de plantão online</li>
  <li><strong>Notificação ao Médico:</strong> O médico de plantão recebe alerta em tempo real via WebSocket</li>
  <li><strong>Prioridade:</strong> Pacientes com triagem vermelha/laranja têm prioridade na fila</li>
</ul>

<h3>7.6 IAM3D durante Videoconsulta (Interconsulta)</h3>
<ul>
  <li>Durante uma videoconsulta ativa, o médico pode invocar o IAM3D para solicitar interconsulta</li>
  <li>O assistente busca especialistas disponíveis e facilita o convite</li>
  <li>Suporte a diagnóstico diferencial em tempo real durante a consulta</li>
</ul>
</div>

<!-- 8. SISTEMA DE CRÉDITOS -->
<div class="page-break">
<h2>8. Sistema de Créditos e Carteira Digital</h2>

<h3>8.1 Créditos TMC (TeleM3D Credits)</h3>
<p>A plataforma utiliza um sistema de créditos interno (TMC) para transações financeiras.</p>
<ul>
  <li>Taxa de câmbio configurável (padrão: 1 USD = 5 TMC)</li>
  <li>Compra via PayPal com 6 pacotes pré-configurados</li>
  <li>15 tipos de custos para funcionalidades do sistema</li>
</ul>

<h3>8.2 Pacotes de Crédito</h3>
<table>
  <tr><th>Pacote</th><th>Créditos</th><th>Preço (USD)</th><th>Bônus</th></tr>
  <tr><td>Básico</td><td>50 TMC</td><td>$10</td><td>-</td></tr>
  <tr><td>Padrão</td><td>120 TMC</td><td>$20</td><td>+20 TMC</td></tr>
  <tr><td>Profissional</td><td>350 TMC</td><td>$50</td><td>+100 TMC</td></tr>
  <tr><td>Premium</td><td>800 TMC</td><td>$100</td><td>+300 TMC</td></tr>
  <tr><td>Empresarial</td><td>2000 TMC</td><td>$200</td><td>+1000 TMC</td></tr>
  <tr><td>Ilimitado</td><td>6000 TMC</td><td>$500</td><td>+3500 TMC</td></tr>
</table>

<h3>8.3 Carteira Digital</h3>
<ul>
  <li><strong>Saldo:</strong> Visualização em TMC e equivalente USD</li>
  <li><strong>Comprar:</strong> Pacotes via PayPal</li>
  <li><strong>Transferir:</strong> Envio de créditos entre usuários</li>
  <li><strong>Histórico:</strong> Todas as transações detalhadas</li>
  <li><strong>Carteira Externa:</strong> Vincular MetaMask/WalletConnect</li>
  <li><strong>Saque:</strong> Solicitar retirada de créditos</li>
  <li><strong>Auditoria:</strong> Log completo com filtros por tipo de ação</li>
</ul>

<h3>8.4 Fluxo de Pagamento</h3>
<div class="diagram">
<svg width="500" height="100" viewBox="0 0 500 100">
  <rect x="10" y="25" width="90" height="50" rx="6" fill="#fef3c7" stroke="#eab308"/>
  <text x="55" y="48" text-anchor="middle" font-size="9" fill="#a16207" font-weight="600">Pacote</text>
  <text x="55" y="63" text-anchor="middle" font-size="8" fill="#475569">Seleciona</text>

  <rect x="120" y="25" width="90" height="50" rx="6" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="165" y="48" text-anchor="middle" font-size="9" fill="#1e40af" font-weight="600">PayPal</text>
  <text x="165" y="63" text-anchor="middle" font-size="8" fill="#475569">Checkout</text>

  <rect x="230" y="25" width="90" height="50" rx="6" fill="#dcfce7" stroke="#22c55e"/>
  <text x="275" y="48" text-anchor="middle" font-size="9" fill="#166534" font-weight="600">Confirmação</text>
  <text x="275" y="63" text-anchor="middle" font-size="8" fill="#475569">Webhook</text>

  <rect x="340" y="25" width="90" height="50" rx="6" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="385" y="48" text-anchor="middle" font-size="9" fill="#6b21a8" font-weight="600">Créditos</text>
  <text x="385" y="63" text-anchor="middle" font-size="8" fill="#475569">Adicionados</text>

  <line x1="100" y1="50" x2="120" y2="50" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="210" y1="50" x2="230" y2="50" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="320" y1="50" x2="340" y2="50" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
</svg>
</div>
</div>

<!-- 9. NFTs E BROKER -->
<div class="page-break">
<h2>9. NFTs Médicos e Broker Interno</h2>

<h3>9.1 NFTs de Dados Médicos</h3>
<p>Sistema de tokenização de insights médicos anonimizados conforme LGPD:</p>
<ul>
  <li>Criação de NFTs a partir de dados clínicos anonimizados</li>
  <li>Registro de consentimento LGPD obrigatório</li>
  <li>Visualização de detalhes e propriedade de cotas</li>
  <li>Compra de participações em NFTs existentes</li>
</ul>

<h3>9.2 Broker Interno</h3>
<ul>
  <li><strong>Order Book:</strong> Livro de ofertas de compra e venda</li>
  <li><strong>Gestão de Ordens:</strong> Criar, cancelar e acompanhar ordens</li>
  <li><strong>Histórico:</strong> Todas as negociações realizadas</li>
  <li><strong>Tokens TM3D:</strong> Token interno para negociação</li>
</ul>

<h3>9.3 Carteira Externa</h3>
<ul>
  <li>Vinculação de endereços MetaMask e WalletConnect</li>
  <li>Gestão de carteiras vinculadas</li>
  <li>Solicitação de saque para carteiras externas</li>
</ul>
</div>

<!-- 10. SEGURANÇA E LGPD -->
<div class="page-break">
<h2>10. Segurança e LGPD</h2>

<h3>10.1 Autenticação e Autorização</h3>
<ul>
  <li>Sessões seguras com Passport.js e cookies httpOnly</li>
  <li>Controle de acesso por função (RBAC): Admin, Médico, Paciente, Visitante</li>
  <li>Tokens temporários para acesso de visitantes</li>
  <li>Logs de auditoria para todas as operações sensíveis</li>
</ul>

<h3>10.2 Conformidade LGPD</h3>
<table>
  <tr><th>Requisito</th><th>Implementação</th></tr>
  <tr><td>Consentimento</td><td>Coleta explícita antes de processamento de dados</td></tr>
  <tr><td>Anonimização</td><td>Dados de NFTs são anonimizados antes da tokenização</td></tr>
  <tr><td>Portabilidade</td><td>Exportação de dados do paciente em formato padrão</td></tr>
  <tr><td>Auditoria</td><td>Log completo de acessos e modificações</td></tr>
  <tr><td>Minimização</td><td>Coleta apenas de dados essenciais para o serviço</td></tr>
</table>

<h3>10.3 Segurança de Dados</h3>
<ul>
  <li>Comunicação criptografada (HTTPS/TLS)</li>
  <li>Senhas hasheadas com scrypt</li>
  <li>WebSocket autenticado com tokens JWT</li>
  <li>Sanitização de entrada contra XSS/SQL injection</li>
</ul>
</div>

<!-- 11. ESTRUTURA DO BANCO -->
<div class="page-break">
<h2>11. Estrutura do Banco de Dados</h2>
<p>PostgreSQL com 61 tabelas gerenciadas pelo Drizzle ORM.</p>

<h3>Tabelas Principais</h3>
<table>
  <tr><th>Tabela</th><th>Descrição</th><th>Relações</th></tr>
  <tr><td>users</td><td>Usuários do sistema (todos os papéis)</td><td>patients, appointments</td></tr>
  <tr><td>patients</td><td>Dados clínicos do paciente</td><td>users, medical_records</td></tr>
  <tr><td>appointments</td><td>Consultas agendadas</td><td>users (doctor), patients</td></tr>
  <tr><td>video_consultations</td><td>Sessões de videoconsulta</td><td>appointments, users</td></tr>
  <tr><td>medical_records</td><td>Prontuários médicos</td><td>patients, users (doctor)</td></tr>
  <tr><td>prescriptions</td><td>Prescrições médicas</td><td>medical_records, users</td></tr>
  <tr><td>consultation_requests</td><td>Solicitações de consulta</td><td>patients, users (doctor)</td></tr>
  <tr><td>chatbot_conversations</td><td>Conversas com IA</td><td>users</td></tr>
  <tr><td>notifications</td><td>Notificações do sistema</td><td>users</td></tr>
  <tr><td>wallet_transactions</td><td>Transações de créditos</td><td>users</td></tr>
  <tr><td>credit_packages</td><td>Pacotes de crédito para venda</td><td>-</td></tr>
  <tr><td>dynamic_nfts</td><td>NFTs de dados médicos</td><td>users (creator)</td></tr>
  <tr><td>broker_orders</td><td>Ordens de compra/venda</td><td>users, dynamic_nfts</td></tr>
  <tr><td>external_wallets</td><td>Carteiras externas vinculadas</td><td>users</td></tr>
  <tr><td>medical_teams</td><td>Equipes médicas</td><td>users (members)</td></tr>
  <tr><td>inter_consultations</td><td>Interconsultas médicas</td><td>users, consultation_sessions</td></tr>
  <tr><td>system_settings</td><td>Configurações globais</td><td>-</td></tr>
  <tr><td>wallet_audit_log</td><td>Log de auditoria de operações financeiras</td><td>users</td></tr>
  <tr><td>nft_ownership</td><td>Propriedade e cotas de NFTs</td><td>dynamic_nfts, users</td></tr>
  <tr><td>broker_trades</td><td>Negociações realizadas no broker</td><td>broker_orders, users</td></tr>
  <tr><td>tm3d_supply</td><td>Controle de supply do token TM3D</td><td>-</td></tr>
  <tr><td>withdrawal_requests</td><td>Solicitações de saque</td><td>users, external_wallets</td></tr>
  <tr><td>post_consultation_items</td><td>Itens gerados pela IA pós-consulta</td><td>consultation_sessions</td></tr>
  <tr><td>diagnostic_inferences</td><td>Classificações diagnósticas com CID/DSM</td><td>consultation_sessions</td></tr>
  <tr><td>consultation_access_tokens</td><td>Tokens QR/código curto para acesso</td><td>consultation_sessions</td></tr>
  <tr><td>consultation_requests</td><td>Solicitações de consulta (2 caminhos)</td><td>patients, users</td></tr>
  <tr><td>consultation_sessions</td><td>Sessões de consulta ativas</td><td>users, appointments</td></tr>
  <tr><td>tmc_credit_packages</td><td>Pacotes de crédito para venda</td><td>-</td></tr>
  <tr><td>paypal_orders</td><td>Ordens de pagamento PayPal</td><td>users, tmc_credit_packages</td></tr>
</table>

<div class="diagram">
<svg width="650" height="280" viewBox="0 0 650 280">
  <text x="325" y="18" text-anchor="middle" font-weight="700" fill="#1e40af" font-size="12">Relacionamento Entidade-Relacionamento (Simplificado)</text>

  <!-- Users central -->
  <rect x="250" y="30" width="120" height="40" rx="6" fill="#1e40af"/>
  <text x="310" y="55" text-anchor="middle" fill="white" font-size="11" font-weight="700">users</text>

  <!-- Connected tables -->
  <rect x="30" y="40" width="100" height="30" rx="4" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="80" y="60" text-anchor="middle" font-size="9" fill="#1e40af">patients</text>
  <line x1="130" y1="55" x2="250" y2="50" stroke="#3b82f6" stroke-width="1.5"/>

  <rect x="30" y="90" width="100" height="30" rx="4" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="80" y="110" text-anchor="middle" font-size="9" fill="#1e40af">appointments</text>
  <line x1="130" y1="105" x2="250" y2="60" stroke="#3b82f6" stroke-width="1.5"/>

  <rect x="30" y="140" width="100" height="30" rx="4" fill="#dcfce7" stroke="#22c55e"/>
  <text x="80" y="160" text-anchor="middle" font-size="9" fill="#166534">medical_records</text>
  <line x1="130" y1="155" x2="80" y2="120" stroke="#22c55e" stroke-width="1"/>

  <rect x="30" y="190" width="100" height="30" rx="4" fill="#dcfce7" stroke="#22c55e"/>
  <text x="80" y="210" text-anchor="middle" font-size="9" fill="#166534">prescriptions</text>
  <line x1="80" y1="190" x2="80" y2="170" stroke="#22c55e" stroke-width="1"/>

  <rect x="500" y="40" width="120" height="30" rx="4" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="560" y="60" text-anchor="middle" font-size="9" fill="#6b21a8">video_consultations</text>
  <line x1="500" y1="55" x2="370" y2="50" stroke="#a855f7" stroke-width="1.5"/>

  <rect x="500" y="90" width="120" height="30" rx="4" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="560" y="110" text-anchor="middle" font-size="9" fill="#6b21a8">chatbot_conversations</text>
  <line x1="500" y1="105" x2="370" y2="60" stroke="#a855f7" stroke-width="1.5"/>

  <rect x="500" y="140" width="120" height="30" rx="4" fill="#fef3c7" stroke="#eab308"/>
  <text x="560" y="160" text-anchor="middle" font-size="9" fill="#a16207">wallet_transactions</text>
  <line x1="500" y1="155" x2="370" y2="60" stroke="#eab308" stroke-width="1.5"/>

  <rect x="500" y="190" width="120" height="30" rx="4" fill="#fef3c7" stroke="#eab308"/>
  <text x="560" y="210" text-anchor="middle" font-size="9" fill="#a16207">dynamic_nfts</text>
  <line x1="500" y1="205" x2="370" y2="60" stroke="#eab308" stroke-width="1.5"/>

  <rect x="200" y="120" width="120" height="30" rx="4" fill="#fee2e2" stroke="#ef4444"/>
  <text x="260" y="140" text-anchor="middle" font-size="9" fill="#991b1b">notifications</text>
  <line x1="260" y1="120" x2="300" y2="70" stroke="#ef4444" stroke-width="1"/>

  <rect x="320" y="120" width="130" height="30" rx="4" fill="#ffedd5" stroke="#f97316"/>
  <text x="385" y="140" text-anchor="middle" font-size="9" fill="#c2410c">consultation_requests</text>
  <line x1="350" y1="120" x2="320" y2="70" stroke="#f97316" stroke-width="1"/>

  <rect x="200" y="200" width="120" height="30" rx="4" fill="#fef3c7" stroke="#eab308"/>
  <text x="260" y="220" text-anchor="middle" font-size="9" fill="#a16207">broker_orders</text>
  <line x1="260" y1="200" x2="300" y2="70" stroke="#eab308" stroke-width="1"/>

  <rect x="340" y="200" width="120" height="30" rx="4" fill="#fef3c7" stroke="#eab308"/>
  <text x="400" y="220" text-anchor="middle" font-size="9" fill="#a16207">external_wallets</text>
  <line x1="370" y1="200" x2="330" y2="70" stroke="#eab308" stroke-width="1"/>

  <rect x="200" y="250" width="120" height="30" rx="4" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="260" y="270" text-anchor="middle" font-size="9" fill="#1e40af">medical_teams</text>
  <line x1="260" y1="250" x2="300" y2="70" stroke="#3b82f6" stroke-width="1"/>

  <rect x="340" y="250" width="130" height="30" rx="4" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="405" y="270" text-anchor="middle" font-size="9" fill="#1e40af">inter_consultations</text>
  <line x1="375" y1="250" x2="330" y2="70" stroke="#3b82f6" stroke-width="1"/>
</svg>
</div>
</div>

<!-- 12. API ENDPOINTS -->
<div class="page-break">
<h2>12. Principais API Endpoints</h2>

<h3>Autenticação</h3>
<table>
  <tr><th>Método</th><th>Endpoint</th><th>Descrição</th></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/auth/login</td><td>Login de usuário</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/auth/register</td><td>Cadastro de novo usuário</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/auth/logout</td><td>Encerrar sessão</td></tr>
  <tr><td><span class="badge badge-blue">GET</span></td><td>/api/auth/me</td><td>Dados do usuário autenticado</td></tr>
</table>

<h3>Consultas e Agendamento</h3>
<table>
  <tr><th>Método</th><th>Endpoint</th><th>Descrição</th></tr>
  <tr><td><span class="badge badge-blue">GET</span></td><td>/api/appointments</td><td>Listar consultas</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/appointments</td><td>Agendar consulta</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/appointments/cancel-all</td><td>Cancelar múltiplas consultas</td></tr>
  <tr><td><span class="badge badge-blue">GET</span></td><td>/api/doctors/online</td><td>Médicos disponíveis</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/doctors/on-duty</td><td>Toggle plantão 24h</td></tr>
</table>

<h3>IA e Chatbot</h3>
<table>
  <tr><th>Método</th><th>Endpoint</th><th>Descrição</th></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/chatbot/message</td><td>Mensagem para IA (autenticado)</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/chatbot/visitor-message</td><td>Mensagem para IA (visitante)</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/chatbot/confirm-appointment</td><td>Confirmar agendamento via chatbot</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/chatbot/urgent-consultation</td><td>Solicitar consulta urgente (plantão)</td></tr>
</table>

<h3>Financeiro</h3>
<table>
  <tr><th>Método</th><th>Endpoint</th><th>Descrição</th></tr>
  <tr><td><span class="badge badge-blue">GET</span></td><td>/api/wallet/balance</td><td>Saldo da carteira</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/wallet/transfer</td><td>Transferir créditos</td></tr>
  <tr><td><span class="badge badge-blue">GET</span></td><td>/api/admin/credit-packages</td><td>Listar pacotes</td></tr>
  <tr><td><span class="badge badge-green">POST</span></td><td>/api/paypal/create-order</td><td>Criar ordem PayPal</td></tr>
</table>
</div>

<!-- 13. INSTALAÇÃO -->
<div class="page-break">
<h2>13. Instalação e Configuração</h2>

<h3>13.1 Requisitos</h3>
<ul>
  <li>Node.js 18+ com npm</li>
  <li>PostgreSQL 14+ (ou Neon serverless)</li>
  <li>Chaves de API: Google Gemini, Agora.io, PayPal</li>
</ul>

<h3>13.2 Variáveis de Ambiente</h3>
<div class="code">DATABASE_URL=postgresql://user:pass@host:5432/db
GEMINI_API_KEY=your_gemini_key
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_cert
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_secret
SESSION_SECRET=random_secure_string</div>

<h3>13.3 Instalação Rápida</h3>
<div class="code">git clone https://github.com/LACibermedicina/tele.M3D.pro.git
cd tele.M3D.pro
npm install
npm run dev</div>

<h3>13.4 Deploy no Replit</h3>
<ol>
  <li>Fork o repositório no Replit</li>
  <li>Configure as variáveis de ambiente no painel Secrets</li>
  <li>O banco PostgreSQL é provisionado automaticamente</li>
  <li>Execute <code>npm run dev</code> para iniciar</li>
</ol>

<div class="info-box">
  <strong>Nota:</strong> As migrações do banco de dados são executadas automaticamente na inicialização do servidor. O seed de dados padrão (pacotes de crédito, custos de funcionalidades, médico padrão) também é executado automaticamente.
</div>
</div>

<!-- 14. EXPORTAÇÃO DE DADOS (FHIR R4) -->
<div class="page-break">
<h2>14. Exportação de Dados do Paciente (HL7 FHIR R4)</h2>
<p>O sistema suporta exportação completa de dados clínicos do paciente em formato HL7 FHIR R4, atendendo a múltiplos padrões internacionais de interoperabilidade.</p>

<h3>14.1 Padrões Suportados</h3>
<table>
  <tr><th>Padrão</th><th>Região</th><th>Conformidade</th></tr>
  <tr><td>Brasil / SUS</td><td>Brasil</td><td>RNDS (Rede Nacional de Dados em Saúde), RAC (Registro de Atendimento Clínico), SBIS, LGPD</td></tr>
  <tr><td>HIPAA / USCDI v3</td><td>Estados Unidos</td><td>Health Insurance Portability and Accountability Act, US Core Data for Interoperability v3</td></tr>
  <tr><td>GDPR</td><td>União Europeia</td><td>General Data Protection Regulation, direitos do titular</td></tr>
  <tr><td>Internacional</td><td>Global</td><td>ICD-11, SNOMED CT, LOINC</td></tr>
</table>

<h3>14.2 Recursos FHIR Exportados</h3>
<ul>
  <li><strong>Patient:</strong> Dados demográficos do paciente</li>
  <li><strong>Encounter:</strong> Registros de consultas e atendimentos</li>
  <li><strong>Condition:</strong> Diagnósticos e condições clínicas (CID-10/11)</li>
  <li><strong>MedicationRequest:</strong> Prescrições médicas</li>
  <li><strong>Observation:</strong> Resultados de exames e observações clínicas</li>
  <li><strong>DiagnosticReport:</strong> Laudos e relatórios diagnósticos</li>
  <li><strong>AllergyIntolerance:</strong> Alergias e intolerâncias registradas</li>
  <li><strong>Immunization:</strong> Registros de vacinação</li>
</ul>

<h3>14.3 Desidentificação (HIPAA Safe Harbor)</h3>
<p>A exportação suporta desidentificação de dados conforme o método Safe Harbor do HIPAA:</p>
<ul>
  <li>Remoção de 18 identificadores diretos (nome, CPF, endereço, telefone, etc.)</li>
  <li>Generalização de datas (manter apenas ano)</li>
  <li>Supressão de dados geográficos granulares</li>
  <li>Substituição de IDs por identificadores opacos</li>
  <li>Manutenção da utilidade clínica dos dados para pesquisa</li>
</ul>

<h3>14.4 Fluxo de Exportação</h3>
<div class="diagram">
<svg width="550" height="100" viewBox="0 0 550 100">
  <rect x="10" y="25" width="100" height="50" rx="6" fill="#dbeafe" stroke="#3b82f6"/>
  <text x="60" y="48" text-anchor="middle" font-size="9" fill="#1e40af" font-weight="600">Selecionar</text>
  <text x="60" y="63" text-anchor="middle" font-size="8" fill="#475569">Paciente + Padrão</text>

  <rect x="130" y="25" width="100" height="50" rx="6" fill="#f3e8ff" stroke="#a855f7"/>
  <text x="180" y="48" text-anchor="middle" font-size="9" fill="#6b21a8" font-weight="600">Processar</text>
  <text x="180" y="63" text-anchor="middle" font-size="8" fill="#475569">FHIR Bundle</text>

  <rect x="250" y="25" width="100" height="50" rx="6" fill="#fef3c7" stroke="#eab308"/>
  <text x="300" y="48" text-anchor="middle" font-size="9" fill="#a16207" font-weight="600">Desidentificar</text>
  <text x="300" y="63" text-anchor="middle" font-size="8" fill="#475569">(Opcional)</text>

  <rect x="370" y="25" width="100" height="50" rx="6" fill="#dcfce7" stroke="#22c55e"/>
  <text x="420" y="48" text-anchor="middle" font-size="9" fill="#166534" font-weight="600">Download</text>
  <text x="420" y="63" text-anchor="middle" font-size="8" fill="#475569">JSON FHIR R4</text>

  <line x1="110" y1="50" x2="130" y2="50" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="230" y1="50" x2="250" y2="50" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="350" y1="50" x2="370" y2="50" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
</svg>
</div>
</div>

<!-- 15. DETECÇÃO DE INATIVIDADE -->
<div class="page-break">
<h2>15. Detecção de Inatividade e Auto-Logout</h2>
<p>O sistema monitora a atividade do usuário para proteger dados sensíveis em terminais compartilhados ou em caso de ausência prolongada.</p>

<h3>15.1 Como Funciona</h3>
<ul>
  <li>O monitor de inatividade rastreia movimentos do mouse, cliques, teclado e scroll</li>
  <li>Após o tempo configurado pelo administrador (padrão: 30 minutos), exibe um prompt de alerta</li>
  <li>O usuário tem 60 segundos para confirmar que deseja continuar</li>
  <li>Se não houver resposta, o sistema realiza auto-logout automático</li>
</ul>

<h3>15.2 Ações do Auto-Logout</h3>
<ul>
  <li>Encerramento da sessão do usuário</li>
  <li>Desconexão de videoconsultas ativas (Agora.io)</li>
  <li>Limpeza de dados sensíveis da memória do navegador</li>
  <li>Redirecionamento para a página de login</li>
  <li>Registro do evento no log de auditoria</li>
</ul>

<h3>15.3 Configuração (Admin)</h3>
<table>
  <tr><th>Parâmetro</th><th>Descrição</th><th>Padrão</th></tr>
  <tr><td>Timeout de inatividade</td><td>Tempo em minutos antes do prompt de alerta</td><td>30 min</td></tr>
  <tr><td>Tempo do prompt</td><td>Tempo de espera para confirmação do usuário</td><td>60 seg</td></tr>
  <tr><td>Ativação</td><td>Habilitar/desabilitar detecção de inatividade</td><td>Ativado</td></tr>
</table>

<div class="info-box">
  <strong>Segurança:</strong> A detecção de inatividade é especialmente importante em ambientes hospitalares e clínicas onde terminais podem ser compartilhados por múltiplos profissionais.
</div>

<div class="footer">
  <p>Tele&lt;M3D&gt; Pro v3.0 — Documentação Gerada em ${today}</p>
  <p>Cybermedicina Ltda. — github.com/LACibermedicina/tele.M3D.pro</p>
</div>

<div class="no-print" style="text-align:center;margin-top:40px;padding:20px">
  <button onclick="window.print()" style="background:#1e40af;color:white;padding:12px 32px;border:none;border-radius:8px;font-size:16px;cursor:pointer;font-weight:600">
    Salvar como PDF (Ctrl+P)
  </button>
</div>

</div>
</body>
</html>`;
}
