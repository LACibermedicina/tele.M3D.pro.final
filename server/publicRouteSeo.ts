const BASE_URL = "https://tele.m3d.pro";

interface RouteSeo {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
  extraHead?: string;
  body?: string;
}

/* ── FAQ structured data ───────────────────────────────────────────────── */

const FAQ_JSONLD = `
  <script type="application/ld+json" id="faq-jsonld-ssr">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type":"Question","name":"Como criar uma conta no TeleM3D?","acceptedAnswer":{"@type":"Answer","text":"Acesse a p\u00e1gina inicial e clique em 'Registrar'. Escolha seu tipo de conta (M\u00e9dico, Paciente ou Administrador), preencha os dados solicitados e confirme. Ap\u00f3s o registro, fa\u00e7a login com seu e-mail e senha."}},
      {"@type":"Question","name":"Como iniciar uma teleconsulta com um paciente?","acceptedAnswer":{"@type":"Answer","text":"Existem tr\u00eas formas: 1) Na Agenda, clique em 'Iniciar' na consulta agendada. 2) Use 'Consulta Instant\u00e2nea' na agenda para chamar um paciente online. 3) No Consult\u00f3rio Virtual, abra a sala e gere um link de acesso para o paciente."}},
      {"@type":"Question","name":"O paciente pode entrar na consulta sem conta?","acceptedAnswer":{"@type":"Answer","text":"Sim. O m\u00e9dico pode gerar um 'Link de Acesso' na agenda. O paciente recebe o link e pode entrar diretamente na sala de espera virtual sem precisar criar uma conta."}},
      {"@type":"Question","name":"Como funciona o acesso por QR Code e c\u00f3digo curto?","acceptedAnswer":{"@type":"Answer","text":"Ao criar uma consulta, o sistema gera automaticamente um QR Code e um c\u00f3digo curto de 6 caracteres. O paciente pode escanear o QR Code com a c\u00e2mera do celular ou digitar o c\u00f3digo curto na p\u00e1gina de acesso para entrar na sala de espera da consulta sem precisar de login."}},
      {"@type":"Question","name":"Quais diretrizes a IA utiliza?","acceptedAnswer":{"@type":"Answer","text":"A IA \u00e9 baseada em: 1) OMS - Diretrizes cl\u00ednicas internacionais (mhGAP, GINA, GOLD). 2) Minist\u00e9rio da Sa\u00fade do Brasil - Cadernos de Aten\u00e7\u00e3o B\u00e1sica, PCDT/CONITEC, RENAME, Previne Brasil. 3) DSM-5/DSM-5-TR - Crit\u00e9rios diagn\u00f3sticos para transtornos mentais."}},
      {"@type":"Question","name":"Meus dados s\u00e3o seguros?","acceptedAnswer":{"@type":"Answer","text":"Sim. O sistema utiliza conex\u00f5es criptografadas (HTTPS/WSS), autentica\u00e7\u00e3o por tokens, controle de acesso baseado em roles (RBAC), detec\u00e7\u00e3o de inatividade com auto-logout e banco de dados PostgreSQL com backups. Dados de sa\u00fade s\u00e3o tratados conforme LGPD, HIPAA e GDPR."}},
      {"@type":"Question","name":"Quais navegadores s\u00e3o suportados?","acceptedAnswer":{"@type":"Answer","text":"O sistema funciona em todos os navegadores modernos: Chrome (recomendado), Edge, Firefox e Safari. Para teleconsultas com transcri\u00e7\u00e3o autom\u00e1tica, recomendamos Chrome ou Edge."}},
      {"@type":"Question","name":"Quais m\u00e9todos de pagamento s\u00e3o aceitos?","acceptedAnswer":{"@type":"Answer","text":"O sistema aceita PayPal (saldo e cart\u00f5es vinculados), Stripe (cart\u00e3o de cr\u00e9dito/d\u00e9bito e Apple Pay) e PagBank (PIX e Boleto Banc\u00e1rio). O checkout unificado permite escolher o m\u00e9todo mais conveniente no momento da compra de cr\u00e9ditos TM3D."}},
      {"@type":"Question","name":"Como criar uma prescri\u00e7\u00e3o digital?","acceptedAnswer":{"@type":"Answer","text":"Em 'Prescri\u00e7\u00f5es', clique em 'Nova Prescri\u00e7\u00e3o', selecione o paciente, adicione medicamentos com dosagens e instru\u00e7\u00f5es. A prescri\u00e7\u00e3o recebe um n\u00famero \u00fanico e pode ser exportada em PDF com assinatura digital."}},
      {"@type":"Question","name":"Posso usar no celular?","acceptedAnswer":{"@type":"Answer","text":"Sim. A interface \u00e9 responsiva e se adapta a dispositivos m\u00f3veis. As teleconsultas por v\u00eddeo tamb\u00e9m funcionam em navegadores mobile (Chrome Android, Safari iOS)."}}
    ]
  }
  </script>`;

/* ── Prerendered body content per public route ─────────────────────────── */

const NAV_LINKS = `
<nav aria-label="Navegação pública" style="margin:1rem 0;padding:0.5rem;background:#f8fafc;border-radius:8px">
  <a href="/" style="margin-right:1rem">Início</a>
  <a href="/features" style="margin-right:1rem">Funcionalidades</a>
  <a href="/documentation" style="margin-right:1rem">Documentação</a>
  <a href="/manual" style="margin-right:1rem">Manual</a>
  <a href="/faq" style="margin-right:1rem">FAQ</a>
  <a href="/login" style="margin-right:1rem">Entrar</a>
  <a href="/register">Criar conta</a>
</nav>`;

const HOME_BODY = `<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Tele&lt;M3D&gt; — Telemedicina com Inteligência Artificial</h1>
  <p>Plataforma completa de telemedicina com IA: videoconsultas em tempo real, triagem inteligente pelo Protocolo de Manchester, agendamento online, prescrições digitais e prontuário eletrônico seguro conforme LGPD, HIPAA e GDPR.</p>
  <section>
    <h2>Para Pacientes</h2>
    <ul>
      <li>Solicite teleconsultas por especialidade ou por triagem de sintomas com IA</li>
      <li>Acesse a sala de espera virtual com QR Code ou código curto, sem necessidade de conta</li>
      <li>Visualize suas prescrições, exames e prontuário digital</li>
      <li>Receba notificações em tempo real sobre suas consultas</li>
    </ul>
    <p><a href="/register/patient">Criar conta de paciente</a></p>
  </section>
  <section>
    <h2>Para Médicos</h2>
    <ul>
      <li>Realize videoconsultas com suporte de IA para diagnóstico e prescrição</li>
      <li>Gerencie agenda, disponibilidade e consultas instantâneas</li>
      <li>Emita prescrições digitais com assinatura ICP-Brasil A3</li>
      <li>Acesse relatórios epidemiológicos e dashboard clínico interativo</li>
    </ul>
    <p><a href="/register/doctor">Criar conta de médico</a></p>
  </section>
  <section>
    <h2>Funcionalidades Principais</h2>
    <ul>
      <li><strong>Videoconsultas</strong> — Agora SDK, transcrição automática, convite de especialistas</li>
      <li><strong>IA Médica</strong> — Google Gemini com diretrizes OMS, MS/Brasil, DSM-5/TR</li>
      <li><strong>Triagem</strong> — Protocolo de Manchester 5 níveis com classificação visual</li>
      <li><strong>Prescrições digitais</strong> — Assinatura digital, QR Code de verificação, integração ANVISA/RxNorm</li>
      <li><strong>Prontuário eletrônico</strong> — PMD v1.0, exportação HL7 FHIR R4, conformidade CFM/LGPD</li>
      <li><strong>Pagamentos</strong> — PayPal, Stripe e PagBank (PIX, boleto, cartão)</li>
      <li><strong>Multilíngue</strong> — 8 idiomas: PT-BR, ES, EN, FR, DE, IT, ZH, GN</li>
    </ul>
  </section>
  <section>
    <h2>Segurança e Conformidade</h2>
    <p>O Tele&lt;M3D&gt; implementa criptografia AES-256, autenticação JWT, controle de acesso baseado em papéis (RBAC), logs de auditoria e conformidade com LGPD, HIPAA e GDPR. Todos os dados de saúde são protegidos conforme as normas do Conselho Federal de Medicina (CFM).</p>
  </section>
  <p><a href="/register">Criar conta gratuita</a> | <a href="/login">Entrar na plataforma</a> | <a href="/faq">Perguntas frequentes</a></p>
</main>`;

const FEATURES_BODY = `<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Recursos e Funcionalidades — Tele&lt;M3D&gt;</h1>
  <p>Conheça os recursos do Tele&lt;M3D&gt;: videoconsultas com IA, triagem por Protocolo de Manchester, agenda inteligente, prescrições digitais, prontuário eletrônico e relatórios clínicos.</p>
  <section>
    <h2>Videoconsultas com IA</h2>
    <p>Consultas médicas em vídeo usando o Agora SDK com latência ultra-baixa. Inclui compartilhamento de tela, transcrição automática por reconhecimento de voz, chat integrado, convite de especialistas em tempo real e gravação de sessão.</p>
  </section>
  <section>
    <h2>Assistente de IA Médica</h2>
    <p>Motor de IA baseado no Google Gemini treinado com diretrizes da OMS, Ministério da Saúde do Brasil e DSM-5/TR. Oferece sugestões diagnósticas com CID-10/11, triagem de sintomas, geração automática de prescrições e análise de interações medicamentosas.</p>
  </section>
  <section>
    <h2>Triagem Inteligente</h2>
    <p>Classificação de risco automática pelo Protocolo de Manchester (5 níveis): Emergência (vermelho), Muito Urgente (laranja), Urgente (amarelo), Pouco Urgente (verde) e Não Urgente (azul). A IA analisa os sintomas e prioriza o atendimento.</p>
  </section>
  <section>
    <h2>Segurança Máxima</h2>
    <p>Criptografia AES-256, autenticação por tokens JWT, controle de acesso baseado em papéis (RBAC), assinatura digital compatível com ICP-Brasil A3, logs de auditoria completos e conformidade com LGPD, HIPAA e GDPR.</p>
  </section>
  <section>
    <h2>Prescrições Digitais</h2>
    <p>Emissão de prescrições com assinatura digital ICP-Brasil, QR Code de verificação pública, integração com bases de medicamentos ANVISA/RENAME, RxNorm (NIH) e OpenFDA. Análise automática de interações medicamentosas.</p>
  </section>
  <section>
    <h2>Prontuário Eletrônico (PMD v1.0)</h2>
    <p>Prontuário Médico Digital conforme normas CFM, LGPD e RGPD. Suporte a exportação HL7 FHIR R4 para padrões Brasil/SUS, EUA (HIPAA/USCDI v3) e Europa (GDPR). Timeline unificada com todos os registros clínicos do paciente.</p>
  </section>
  <section>
    <h2>Agenda e Agendamento</h2>
    <p>Sistema de agendamento com visualização diária, semanal e histórico. Consultas instantâneas para médicos de plantão, exportação iCal, cancelamento em massa e notificações em tempo real por WebSocket.</p>
  </section>
  <section>
    <h2>Integração WhatsApp IA</h2>
    <p>Módulo de mensagens inteligentes para médicos com análise de IA, histórico persistente, status online em tempo real e notificações de resposta bidirecional.</p>
  </section>
  <section>
    <h2>Farmácia e Dispensação</h2>
    <p>Módulo completo de farmácia: verificação de prescrições, assinatura digital, rastreamento de lotes, relatórios LGPD-compliant e integração com o fluxo pós-consulta.</p>
  </section>
  <section>
    <h2>Pagamentos Unificados</h2>
    <p>Checkout unificado com PayPal, Stripe (cartão, Apple Pay) e PagBank (PIX, boleto). Carteira digital TM3D com transferências, saques e histórico completo de transações.</p>
  </section>
  <section>
    <h2>Stack Tecnológica</h2>
    <ul>
      <li>Frontend: React 18 + TypeScript + Vite</li>
      <li>Backend: Node.js + Express + TypeScript</li>
      <li>Banco de dados: PostgreSQL via Neon + Drizzle ORM</li>
      <li>IA: Google Gemini API</li>
      <li>Vídeo: Agora SDK</li>
      <li>Pagamentos: PayPal, Stripe, PagBank</li>
    </ul>
  </section>
  <p><a href="/register">Criar conta</a> | <a href="/documentation">Ver documentação</a> | <a href="/faq">FAQ</a></p>
</main>`;

const DOCUMENTATION_BODY = `<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Documentação do Sistema Tele&lt;M3D&gt;</h1>
  <p>Manual completo de recursos, funcionalidades e guias de uso. Versão 4.0 — Atualizado em Abril 2026.</p>
  <section>
    <h2>Consultas e Atendimento</h2>
    <ul>
      <li><strong>Videoconsultas</strong> — Sessões de vídeo em tempo real com Agora SDK. Suporte a múltiplos participantes, compartilhamento de tela, chat e transcrição automática.</li>
      <li><strong>Agendamento inteligente</strong> — Calendário com disponibilidade em tempo real. Consultas agendadas, instantâneas e por demanda.</li>
      <li><strong>Triagem pelo Protocolo de Manchester</strong> — Classificação em 5 níveis de urgência com suporte a WHO ETAT como fallback.</li>
      <li><strong>Acesso sem conta</strong> — Pacientes podem entrar em consultas via QR Code ou código curto de 6 caracteres sem criar conta.</li>
    </ul>
  </section>
  <section>
    <h2>Inteligência Artificial</h2>
    <ul>
      <li><strong>Motor de IA Médica</strong> — Google Gemini com diretrizes OMS, MS/Brasil (PCDT, RENAME, Previne Brasil) e DSM-5/DSM-5-TR.</li>
      <li><strong>Prescrições automáticas</strong> — Geração pós-consulta de prescrições, pedidos de exame e encaminhamentos, com revisão médica obrigatória.</li>
      <li><strong>Chatbot médico</strong> — Assistente contextual disponível 24/7 para dúvidas clínicas e navegação pelo sistema.</li>
      <li><strong>IAM3D</strong> — Assistente de voz com esfera 3D animada, reconhecimento de voz (STT) e síntese de voz (TTS) em 8 idiomas.</li>
      <li><strong>Análise de ECG e Radiologia</strong> — Pipeline triplo de verificação com anotações coloridas e visualizações de IA.</li>
    </ul>
  </section>
  <section>
    <h2>Gestão de Dados Médicos</h2>
    <ul>
      <li><strong>Prontuário Eletrônico PMD v1.0</strong> — Conforme CFM, LGPD e RGPD. Logs de auditoria, timeline unificada.</li>
      <li><strong>Exportação HL7 FHIR R4</strong> — Padrões Brasil/SUS (RNDS, RAC, SBIS, LGPD), EUA (HIPAA, USCDI v3), Europa (GDPR), Internacional (ICD-11, SNOMED CT).</li>
      <li><strong>Assinatura digital</strong> — Compatível com ICP-Brasil A3 e RSA-SHA256. QR Code de verificação pública em endpoint aberto.</li>
      <li><strong>SUS Prontuário</strong> — Geração de prontuário padrão SUS com seções clínicas completas e verificação SOAP.</li>
    </ul>
  </section>
  <section>
    <h2>Segurança e Conformidade</h2>
    <ul>
      <li>Criptografia AES-256 em repouso e HTTPS/WSS em trânsito</li>
      <li>Autenticação JWT com múltiplos tipos de token (usuário, visitante, consulta)</li>
      <li>Controle de acesso RBAC (paciente, médico, admin, farmacêutico, pesquisador)</li>
      <li>Detecção de inatividade com auto-logout configurável</li>
      <li>Conformidade: LGPD, HIPAA, GDPR, CFM, Ordem dos Médicos</li>
    </ul>
  </section>
  <section>
    <h2>Sistema de Créditos TM3D</h2>
    <p>Moeda virtual da plataforma. Adquira pacotes via PayPal, Stripe ou PagBank (PIX/boleto). Carteira digital com transferências entre usuários, histórico de transações e solicitações de saque.</p>
  </section>
  <section>
    <h2>Guias de Uso por Perfil</h2>
    <ul>
      <li><strong>Paciente</strong> — Cadastro, agendamento, acesso por QR Code, prontuário, prescrições</li>
      <li><strong>Médico</strong> — Agenda, videoconsulta, prescrições, notas clínicas, dashboard FHIR</li>
      <li><strong>Administrador</strong> — Gestão de usuários, configurações, relatórios, pagamentos</li>
      <li><strong>Farmacêutico</strong> — Verificação de prescrições, dispensação, relatórios LGPD</li>
    </ul>
  </section>
  <p><a href="/manual">Manual do usuário</a> | <a href="/features">Funcionalidades</a> | <a href="/faq">FAQ</a></p>
</main>`;

const MANUAL_BODY = `<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Manual do Usuário — Tele&lt;M3D&gt;</h1>
  <p>Guia passo a passo para usar o Tele&lt;M3D&gt;: como criar conta, iniciar teleconsultas, gerenciar agenda, emitir prescrições e usar a assistência por IA.</p>
  <section>
    <h2>Modalidades de Acesso</h2>
    <ul>
      <li><strong>Clássica</strong> — Interface simplificada, ideal para usuários iniciantes</li>
      <li><strong>Profissional</strong> — Acesso completo a todos os recursos (padrão)</li>
      <li><strong>Assistida</strong> — Interface guiada pelo assistente de voz IAM3D</li>
    </ul>
  </section>
  <section>
    <h2>Primeiros Passos — Criar Conta</h2>
    <ol>
      <li>Acesse <a href="/register">Criar Conta</a> e escolha seu perfil: Paciente, Médico, Administrador ou Farmacêutico</li>
      <li>Preencha seus dados pessoais e profissionais (médicos: CRM obrigatório)</li>
      <li>Confirme o cadastro e faça login em <a href="/login">Entrar</a></li>
    </ol>
  </section>
  <section>
    <h2>Acesso sem Conta (Pacientes)</h2>
    <p>Pacientes podem entrar em consultas sem criar conta usando:</p>
    <ul>
      <li>QR Code gerado pelo médico — escaneie com a câmera do celular</li>
      <li>Código curto de 6 caracteres — acesse <a href="/acesso">Acesso à Consulta</a> e digite o código</li>
      <li>Link direto enviado pelo médico via WhatsApp ou e-mail</li>
    </ul>
  </section>
  <section>
    <h2>Para Médicos — Iniciar uma Teleconsulta</h2>
    <ol>
      <li>Na Agenda, clique em "Iniciar" na consulta agendada</li>
      <li>Ou use "Consulta Instantânea" para chamar um paciente online imediatamente</li>
      <li>Na sala, use os controles para câmera, microfone, compartilhamento de tela e transcrição</li>
      <li>Convide especialistas em tempo real via "Convidar Especialista"</li>
    </ol>
  </section>
  <section>
    <h2>Para Pacientes — Participar de uma Consulta</h2>
    <ol>
      <li>Receba o link ou código de acesso do seu médico</li>
      <li>Acesse <a href="/acesso">Acesso à Consulta</a> e insira o código, ou abra o link direto</li>
      <li>Aguarde na sala de espera virtual até o médico iniciar a consulta</li>
    </ol>
  </section>
  <section>
    <h2>Assistente de Voz IAM3D</h2>
    <p>Clique no ícone de microfone flutuante para ativar o assistente de voz. O IAM3D responde perguntas médicas, navega pelo sistema e pode solicitar consultas urgentes. Suporta 8 idiomas: PT-BR, ES, EN, FR, DE, IT, ZH, GN.</p>
  </section>
  <section>
    <h2>Prescrições Digitais</h2>
    <p>Médicos emitem prescrições digitais com assinatura ICP-Brasil A3. Cada prescrição tem um QR Code de verificação pública. Farmacêuticos verificam a autenticidade antes da dispensação.</p>
  </section>
  <section>
    <h2>Suporte Multilíngue</h2>
    <p>O sistema suporta 8 idiomas: Português (BR), Espanhol (ES), Inglês (EN), Francês (FR), Alemão (DE), Italiano (IT), Chinês (ZH) e Guarani (GN). Troque o idioma pelo seletor no cabeçalho da página.</p>
  </section>
  <p><a href="/documentation">Documentação técnica</a> | <a href="/faq">Perguntas frequentes</a> | <a href="/register">Criar conta</a></p>
</main>`;

const FAQ_BODY = `<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Perguntas Frequentes — Tele&lt;M3D&gt;</h1>
  <p>Respostas para as dúvidas mais comuns sobre o Tele&lt;M3D&gt;: contas, teleconsultas, câmera e microfone, acesso por QR Code, prescrições e diretrizes de IA.</p>
  <dl>
    <dt><strong>Como criar uma conta no Tele&lt;M3D&gt;?</strong></dt>
    <dd>Acesse a página inicial e clique em 'Registrar'. Escolha seu tipo de conta (Médico, Paciente ou Administrador), preencha os dados solicitados e confirme. Após o registro, faça login com seu e-mail e senha.</dd>
    <dt><strong>Esqueci minha senha. Como recuperar?</strong></dt>
    <dd>Na página de login, clique em 'Esqueceu sua senha?' e siga as instruções para redefinição. Você receberá um e-mail com um link para criar uma nova senha.</dd>
    <dt><strong>Como iniciar uma teleconsulta com um paciente?</strong></dt>
    <dd>Existem três formas: 1) Na Agenda, clique em 'Iniciar' na consulta agendada. 2) Use 'Consulta Instantânea' na agenda para chamar um paciente online. 3) No Consultório Virtual, abra a sala e gere um link de acesso para o paciente.</dd>
    <dt><strong>Minha câmera ou microfone não funciona na teleconsulta. O que fazer?</strong></dt>
    <dd>Verifique se o navegador tem permissão para acessar câmera e microfone (clique no ícone de cadeado na barra de endereço). O sistema funciona melhor em Chrome ou Edge.</dd>
    <dt><strong>O paciente pode entrar na consulta sem conta?</strong></dt>
    <dd>Sim. O médico pode gerar um 'Link de Acesso' na agenda. O paciente recebe o link e pode entrar diretamente na sala de espera virtual sem precisar criar uma conta.</dd>
    <dt><strong>Como funciona o acesso por QR Code e código curto?</strong></dt>
    <dd>Ao criar uma consulta, o sistema gera automaticamente um QR Code e um código curto de 6 caracteres. O paciente pode escanear o QR Code com a câmera do celular ou digitar o código curto na página de acesso para entrar sem precisar de login.</dd>
    <dt><strong>Posso compartilhar minha tela durante a consulta?</strong></dt>
    <dd>Sim (apenas médicos). Durante a videoconsulta, clique no botão de compartilhamento de tela na barra de controles.</dd>
    <dt><strong>Como funciona a transcrição automática?</strong></dt>
    <dd>A transcrição usa o reconhecimento de voz do navegador (disponível em Chrome e Edge). Clique no botão de transcrição para ativar.</dd>
    <dt><strong>Posso convidar outro médico para a consulta?</strong></dt>
    <dd>Sim. Durante a videoconsulta, clique em 'Convidar Especialista' para ver médicos online e enviar um convite.</dd>
    <dt><strong>Quais diretrizes a IA utiliza?</strong></dt>
    <dd>A IA é baseada em: 1) OMS - Diretrizes clínicas internacionais (mhGAP, GINA, GOLD). 2) Ministério da Saúde do Brasil - Cadernos de Atenção Básica, PCDT/CONITEC, RENAME, Previne Brasil. 3) DSM-5/DSM-5-TR - Critérios diagnósticos para transtornos mentais.</dd>
    <dt><strong>Posso confiar nas respostas da IA?</strong></dt>
    <dd>A IA é um assistente de apoio à decisão clínica, NÃO substitui o julgamento médico. Todas as respostas devem ser avaliadas pelo profissional de saúde.</dd>
    <dt><strong>O que é a classificação de risco automática?</strong></dt>
    <dd>O sistema utiliza o Protocolo de Manchester (MTS) para classificar a urgência em 5 níveis: Emergência (vermelho), Muito Urgente (laranja), Urgente (amarelo), Padrão (verde) e Não Urgente (azul).</dd>
    <dt><strong>Como configurar meus horários de atendimento?</strong></dt>
    <dd>Vá em 'Disponibilidade' no menu. Configure seus horários semanais (dia, horário de início/fim, duração da consulta). Ative 'Status Online' para aparecer disponível.</dd>
    <dt><strong>Como criar uma prescrição digital?</strong></dt>
    <dd>Em 'Prescrições', clique em 'Nova Prescrição', selecione o paciente, adicione medicamentos com dosagens e instruções. A prescrição recebe um número único e pode ser exportada em PDF com assinatura digital.</dd>
    <dt><strong>O paciente pode ver suas prescrições?</strong></dt>
    <dd>Sim. Quando o paciente tem prescrições ativas (dentro da data de validade), o item 'Prescrições' aparece automaticamente no menu de navegação.</dd>
    <dt><strong>Como funcionam os créditos TM3D?</strong></dt>
    <dd>TM3D é a moeda virtual do sistema. Adquira pacotes de créditos na página 'Créditos' via PayPal, Stripe ou PagBank.</dd>
    <dt><strong>Quais métodos de pagamento são aceitos?</strong></dt>
    <dd>O sistema aceita PayPal (saldo e cartões vinculados), Stripe (cartão de crédito/débito e Apple Pay) e PagBank (PIX e Boleto Bancário).</dd>
    <dt><strong>O que é o assistente de voz IAM3D?</strong></dt>
    <dd>O IAM3D é um assistente de voz inteligente integrado ao sistema, com reconhecimento e síntese de voz em 8 idiomas (PT-BR, ES, EN, FR, DE, IT, ZH, GN).</dd>
    <dt><strong>Meus dados são seguros?</strong></dt>
    <dd>Sim. O sistema utiliza conexões criptografadas (HTTPS/WSS), autenticação por tokens, controle de acesso RBAC, detecção de inatividade com auto-logout e banco de dados PostgreSQL. Dados de saúde são tratados conforme LGPD, HIPAA e GDPR.</dd>
    <dt><strong>O sistema é compatível com HIPAA?</strong></dt>
    <dd>Sim. O sistema implementa controles compatíveis com HIPAA, incluindo des-identificação de dados (Safe Harbor), controle de acesso baseado em papéis, log de auditoria e exportação FHIR R4 com USCDI v3.</dd>
    <dt><strong>Quais navegadores são suportados?</strong></dt>
    <dd>O sistema funciona em todos os navegadores modernos: Chrome (recomendado), Edge, Firefox e Safari.</dd>
    <dt><strong>Posso usar no celular?</strong></dt>
    <dd>Sim. A interface é responsiva e se adapta a dispositivos móveis. As teleconsultas por vídeo também funcionam em Chrome Android e Safari iOS.</dd>
    <dt><strong>É possível exportar prontuários no padrão FHIR?</strong></dt>
    <dd>Sim. O sistema suporta exportação de dados do paciente no padrão HL7 FHIR R4, compatível com padrões Brasil/SUS (RNDS, RAC, SBIS, LGPD), EUA (HIPAA, USCDI v3), Europa (GDPR) e Internacional (ICD-11, SNOMED CT).</dd>
    <dt><strong>O que é o PMD (Prontuário Médico Digital)?</strong></dt>
    <dd>O PMD v1.0 é o Prontuário Médico Digital do sistema, em conformidade com as normas do CFM, LGPD e RGPD, com logs de auditoria completos.</dd>
    <dt><strong>O que é o módulo de Farmácia?</strong></dt>
    <dd>O módulo de Farmácia permite que farmacêuticos acessem prescrições digitais, verifiquem assinaturas digitais e CRM, realizem a dispensação de medicamentos e gerem relatórios compatíveis com a LGPD.</dd>
    <dt><strong>Quais idiomas o sistema suporta?</strong></dt>
    <dd>O sistema suporta 8 idiomas: Português (BR), Espanhol (ES), Inglês (EN), Francês (FR), Alemão (DE), Italiano (IT), Chinês (ZH) e Guarani (GN).</dd>
    <dt><strong>Como funciona a inter-consulta entre médicos?</strong></dt>
    <dd>A inter-consulta permite que um médico solicite a participação de outro especialista em um caso clínico, seja em tempo real durante uma videoconsulta ou agendada para data futura.</dd>
    <dt><strong>O que a IA gera automaticamente após uma consulta?</strong></dt>
    <dd>Após finalizar uma teleconsulta, a IA pode gerar automaticamente: prescrições com medicamentos e dosagens, pedidos de exames laboratoriais, encaminhamentos para especialistas e sugestões de acompanhamento. O médico revisa, edita e aprova cada item.</dd>
    <dt><strong>Como funciona a verificação de assinatura digital?</strong></dt>
    <dd>O sistema utiliza um esquema de assinatura dual-path: RSA-PSS compatível com ICP-Brasil A3 e RSA-SHA256 para verificação local. Prescrições e documentos assinados incluem um QR Code que aponta para um endpoint público de verificação.</dd>
  </dl>
  <p><a href="/register">Criar conta</a> | <a href="/login">Entrar</a> | <a href="/documentation">Documentação</a></p>
</main>`;

const LOGIN_BODY = `<main style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Entrar — Tele&lt;M3D&gt;</h1>
  <p>Acesse sua conta Tele&lt;M3D&gt; para gerenciar teleconsultas, agenda, prescrições e prontuários com segurança.</p>
  <p>Não tem conta? <a href="/register">Criar conta gratuita</a></p>
  <p>Acesso a consulta sem conta: <a href="/acesso">Entrar com código de acesso</a></p>
</main>`;

const REGISTER_BODY = `<main style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Criar Conta — Tele&lt;M3D&gt;</h1>
  <p>Crie sua conta no Tele&lt;M3D&gt; e comece a usar a plataforma de telemedicina com IA.</p>
  <ul>
    <li><a href="/register/patient">Sou Paciente</a> — Agende teleconsultas, acesse prescrições e prontuário</li>
    <li><a href="/register/doctor">Sou Médico</a> — Realize teleconsultas, gerencie agenda e emita prescrições</li>
    <li><a href="/register/admin">Sou Administrador</a> — Gerencie usuários e configurações da clínica</li>
    <li><a href="/register/pharmacist">Sou Farmacêutico</a> — Verifique prescrições e gerencie dispensação</li>
  </ul>
  <p>Já tem conta? <a href="/login">Entrar</a></p>
</main>`;

const REGISTER_PATIENT_BODY = `<main style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Cadastro de Paciente — Tele&lt;M3D&gt;</h1>
  <p>Crie sua conta de paciente no Tele&lt;M3D&gt; para agendar teleconsultas, acessar prescrições e acompanhar seu prontuário digital.</p>
  <p>Já tem conta? <a href="/login">Entrar</a> | Outros perfis: <a href="/register">Escolher perfil</a></p>
</main>`;

const REGISTER_DOCTOR_BODY = `<main style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Cadastro de Médico — Tele&lt;M3D&gt;</h1>
  <p>Crie sua conta de médico no Tele&lt;M3D&gt; para realizar teleconsultas, gerenciar agenda, emitir prescrições digitais e usar a assistência por IA médica.</p>
  <p>Já tem conta? <a href="/login">Entrar</a> | Outros perfis: <a href="/register">Escolher perfil</a></p>
</main>`;

const REGISTER_ADMIN_BODY = `<main style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Cadastro de Administrador — Tele&lt;M3D&gt;</h1>
  <p>Crie sua conta de administrador no Tele&lt;M3D&gt; para gerenciar usuários, configurações da clínica e operações da plataforma.</p>
  <p>Já tem conta? <a href="/login">Entrar</a> | Outros perfis: <a href="/register">Escolher perfil</a></p>
</main>`;

const REGISTER_PHARMACIST_BODY = `<main style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem">
  ${NAV_LINKS}
  <h1>Cadastro de Farmacêutico — Tele&lt;M3D&gt;</h1>
  <p>Crie sua conta de farmacêutico no Tele&lt;M3D&gt; para verificar prescrições digitais e gerenciar a dispensação de medicamentos.</p>
  <p>Já tem conta? <a href="/login">Entrar</a> | Outros perfis: <a href="/register">Escolher perfil</a></p>
</main>`;

/* ── Route map ─────────────────────────────────────────────────────────── */

const ROUTE_SEO_MAP: Array<{ pattern: RegExp; seo: RouteSeo }> = [
  {
    pattern: /^\/$/,
    seo: {
      title: "Tele<M3D> - Telemedicina com IA | Consultas, Agenda e Prontu\u00e1rio",
      description: "Plataforma completa de telemedicina com IA: videoconsultas, triagem inteligente, agendamento, prescri\u00e7\u00f5es digitais e prontu\u00e1rio eletr\u00f4nico seguro.",
      canonicalPath: "/",
      body: HOME_BODY,
    },
  },
  {
    pattern: /^\/features$/,
    seo: {
      title: "Funcionalidades - Tele<M3D>",
      description: "Conhe\u00e7a os recursos do Tele<M3D>: videoconsultas com IA, triagem por Protocolo de Manchester, agenda, prescri\u00e7\u00f5es, prontu\u00e1rio eletr\u00f4nico e relat\u00f3rios cl\u00ednicos.",
      canonicalPath: "/features",
      body: FEATURES_BODY,
    },
  },
  {
    pattern: /^\/documentation$/,
    seo: {
      title: "Documenta\u00e7\u00e3o - Tele<M3D>",
      description: "Documenta\u00e7\u00e3o t\u00e9cnica e guias do Tele<M3D> para m\u00e9dicos, pacientes e administradores: configura\u00e7\u00e3o, fluxos de consulta e integra\u00e7\u00e3o de recursos.",
      canonicalPath: "/documentation",
      body: DOCUMENTATION_BODY,
    },
  },
  {
    pattern: /^\/manual$/,
    seo: {
      title: "Manual do Usu\u00e1rio - Tele<M3D>",
      description: "Manual passo a passo do Tele<M3D>: como criar conta, iniciar teleconsultas, gerenciar agenda, emitir prescri\u00e7\u00f5es e usar a assist\u00eancia por IA.",
      canonicalPath: "/manual",
      body: MANUAL_BODY,
    },
  },
  {
    pattern: /^\/faq$/,
    seo: {
      title: "Perguntas Frequentes (FAQ) - Tele<M3D>",
      description: "Respostas para as d\u00favidas mais comuns sobre o Tele<M3D>: contas, teleconsultas, c\u00e2mera e microfone, acesso por QR Code, prescri\u00e7\u00f5es e diretrizes de IA.",
      canonicalPath: "/faq",
      extraHead: FAQ_JSONLD,
      body: FAQ_BODY,
    },
  },
  {
    pattern: /^\/login$/,
    seo: {
      title: "Entrar - Tele<M3D>",
      description: "Acesse sua conta Tele<M3D> para gerenciar teleconsultas, agenda, prescri\u00e7\u00f5es e prontu\u00e1rios com seguran\u00e7a.",
      canonicalPath: "/login",
      body: LOGIN_BODY,
    },
  },
  {
    pattern: /^\/register\/patient$/,
    seo: {
      title: "Cadastro de Paciente - Tele<M3D>",
      description: "Crie sua conta de paciente no Tele<M3D> para agendar teleconsultas, acessar prescri\u00e7\u00f5es e acompanhar seu prontu\u00e1rio.",
      canonicalPath: "/register/patient",
      body: REGISTER_PATIENT_BODY,
    },
  },
  {
    pattern: /^\/register\/doctor$/,
    seo: {
      title: "Cadastro de M\u00e9dico - Tele<M3D>",
      description: "Crie sua conta de m\u00e9dico no Tele<M3D> para realizar teleconsultas, gerenciar agenda, emitir prescri\u00e7\u00f5es e usar a assist\u00eancia por IA.",
      canonicalPath: "/register/doctor",
      body: REGISTER_DOCTOR_BODY,
    },
  },
  {
    pattern: /^\/register\/admin$/,
    seo: {
      title: "Cadastro de Administrador - Tele<M3D>",
      description: "Crie sua conta de administrador no Tele<M3D> para gerenciar usu\u00e1rios, configura\u00e7\u00f5es da cl\u00ednica e opera\u00e7\u00f5es da plataforma.",
      canonicalPath: "/register/admin",
      body: REGISTER_ADMIN_BODY,
    },
  },
  {
    pattern: /^\/register\/pharmacist$/,
    seo: {
      title: "Cadastro de Farmac\u00eautico - Tele<M3D>",
      description: "Crie sua conta de farmac\u00eautico no Tele<M3D> para verificar prescri\u00e7\u00f5es e gerenciar a dispensa\u00e7\u00e3o de medicamentos.",
      canonicalPath: "/register/pharmacist",
      body: REGISTER_PHARMACIST_BODY,
    },
  },
  {
    pattern: /^\/register(\/.*)?$/,
    seo: {
      title: "Criar Conta - Tele<M3D>",
      description: "Crie sua conta no Tele<M3D> como m\u00e9dico, paciente, administrador ou farmac\u00eautico e comece a usar a plataforma de telemedicina com IA.",
      canonicalPath: "/register",
      body: REGISTER_BODY,
    },
  },
  {
    pattern: /^\/immediate-consultation$/,
    seo: {
      title: "Sala de Espera \u2014 Consulta Imediata - Tele<M3D>",
      description: "Sala de espera virtual para consulta imediata. Acesso por link de atendimento.",
      canonicalPath: "/immediate-consultation",
      noIndex: true,
    },
  },
  {
    pattern: /^\/acesso(\/.*)?$/,
    seo: {
      title: "Acesso \u00e0 Consulta - Tele<M3D>",
      description: "Entre na sala de espera da sua teleconsulta usando o c\u00f3digo de acesso ou QR Code.",
      canonicalPath: "/acesso",
      noIndex: true,
    },
  },
  {
    pattern: /^\/join\/.+$/,
    seo: {
      title: "Entrar na Consulta - Tele<M3D>",
      description: "Acesse sua teleconsulta atrav\u00e9s do link recebido.",
      canonicalPath: "/join",
      noIndex: true,
    },
  },
];

function matchRouteSeo(pathname: string): RouteSeo | null {
  for (const entry of ROUTE_SEO_MAP) {
    if (entry.pattern.test(pathname)) return entry.seo;
  }
  return null;
}

function safeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function injectSeoIntoHtml(html: string, pathname: string): string {
  const seo = matchRouteSeo(pathname);
  if (!seo) return html;

  const canonicalUrl = BASE_URL + seo.canonicalPath;
  const robotsContent = seo.noIndex ? "noindex, nofollow" : "index, follow";
  const title = seo.title;
  const desc = seo.description;

  let result = html;

  // Use [\s\S]*? so the title regex tolerates <M3D> angle brackets inside the title text
  result = result.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${safeAttr(title)}</title>`);

  result = result.replace(
    /(<meta name="description" content=")[^"]*(")/,
    () => `<meta name="description" content="${safeAttr(desc)}"`,
  );

  result = result.replace(
    /(<meta name="robots" content=")[^"]*(")/,
    () => `<meta name="robots" content="${robotsContent}"`,
  );

  result = result.replace(
    /(<link rel="canonical" href=")[^"]*(")/,
    () => `<link rel="canonical" href="${safeAttr(canonicalUrl)}"`,
  );

  result = result.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    () => `<meta property="og:title" content="${safeAttr(title)}"`,
  );

  result = result.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    () => `<meta property="og:description" content="${safeAttr(desc)}"`,
  );

  result = result.replace(
    /(<meta property="og:url" content=")[^"]*(")/,
    () => `<meta property="og:url" content="${safeAttr(canonicalUrl)}"`,
  );

  result = result.replace(
    /(<meta name="twitter:title" content=")[^"]*(")/,
    () => `<meta name="twitter:title" content="${safeAttr(title)}"`,
  );

  result = result.replace(
    /(<meta name="twitter:description" content=")[^"]*(")/,
    () => `<meta name="twitter:description" content="${safeAttr(desc)}"`,
  );

  if (seo.extraHead) {
    result = result.replace("</head>", `${seo.extraHead}\n  </head>`);
  }

  // Inject prerendered body content into the React root div.
  // Since the app uses createRoot(...).render() (not hydrateRoot), React will
  // cleanly replace this content on mount — no hydration mismatch errors.
  if (seo.body) {
    result = result.replace(
      '<div id="root"></div>',
      () => `<div id="root">${seo.body}</div>`,
    );
  }

  return result;
}

export function isNoIndexPath(pathname: string): boolean {
  return (
    /^\/immediate-consultation$/.test(pathname) ||
    /^\/acesso(\/.*)?$/.test(pathname) ||
    /^\/join\/.+$/.test(pathname)
  );
}
