# 📚 Guia de Uso - Sistema de Telemedicina

## 🎯 Visão Geral
Este guia fornece exemplos práticos baseados na implementação atual do sistema, organizados por perfil de usuário e funcionalidades reais disponíveis.

---

## 👤 Credenciais de Teste

⚠️ **ATENÇÃO**: Estas credenciais são EXCLUSIVAMENTE para ambiente de desenvolvimento/teste. **NUNCA use em produção!**

### 👨‍⚕️ Médicos
- **Username:** `medico.teste` | **Password:** `medico123`
- **Username:** `dra.ana` | **Password:** `medico123`

### 👨‍💼 Administrador
- **Username:** `admin.teste` | **Password:** `admin123`

### 🏥 Pacientes
- **Username:** `maria.santos` | **Password:** `paciente123`
- **Username:** `jose.oliveira` | **Password:** `paciente123`

---

## 🗺️ Navegação da Aplicação

### Rotas Principais Disponíveis:
- **Dashboard** (`/` ou `/dashboard`) - Visão geral e widgets principais
- **Pacientes** (`/patients`) - Gestão de pacientes (médicos/admin)
- **Agenda** (`/schedule`) - Calendário e agendamentos (médicos/admin)
- **WhatsApp** (`/whatsapp`) - Comunicação via WhatsApp (médicos/admin)
- **Prontuários** (`/records`) - Prontuários médicos (todos os usuários)
- **Admin** (`/admin`) - Painel administrativo (apenas admin)
- **Login** (`/login`) - Página de autenticação

---

## 🏥 GUIA RÁPIDO PARA MÉDICOS

### 1. Primeiro Acesso
```
1. Acesse a aplicação
2. Digite: medico.teste
3. Senha: medico123
4. Clique em "Entrar"
✅ Resultado: Dashboard médico carregado
```

### 2. Dashboard Principal
```
1. Após login, você verá 4 cartões estatísticos:
   - Consultas de Hoje
   - Mensagens WhatsApp
   - Agendamento IA
   - Registros Seguros

2. Widgets disponíveis na página:
   - Agenda de Hoje (lateral direita)
   - Integração WhatsApp
   - Assistente Clínico IA
   - Assinaturas Digitais
   - Colaboradores Médicos
   - Resultados de Exames
✅ Resultado: Visão completa das atividades
```

### 3. Gerenciar Pacientes
```
1. Clique em "Pacientes" no menu superior
2. Visualize lista de pacientes existentes
3. Para adicionar: clique no botão "Adicionar Paciente"
4. Para ver perfil: clique no nome do paciente
✅ Resultado: Gestão completa de pacientes
```

### 4. Agenda e Agendamentos
```
1. Clique em "Agenda" no menu superior
2. Visualize calendário de compromissos
3. Para criar: clique em horário vazio
4. Para editar: clique em compromisso existente
✅ Resultado: Controle total da agenda
```

### 5. Comunicação WhatsApp
```
1. Clique em "WhatsApp" no menu superior
2. Visualize mensagens recentes de pacientes
3. Use o widget no dashboard para acesso rápido
✅ Resultado: Comunicação centralizada
```

### 6. Prontuários Médicos
```
1. Clique em "Prontuários" no menu superior
2. Acesse prontuários de pacientes
3. Crie novos registros médicos
✅ Resultado: Documentação médica organizada
```

---

## 👤 GUIA RÁPIDO PARA PACIENTES

### 1. Acesso do Paciente
```
1. Faça login com: maria.santos
2. Senha: paciente123
3. Acesse dashboard personalizado
✅ Resultado: Visão do paciente carregada
```

### 2. Visualizar Informações Pessoais
```
1. No dashboard, veja suas informações:
   - Próximas consultas
   - Prontuários disponíveis
   - Comunicações recentes
✅ Resultado: Acesso às informações de saúde
```

### 3. Acessar Prontuários
```
1. Clique em "Prontuários"
2. Visualize seu histórico médico
3. Veja prescrições e tratamentos
✅ Resultado: Histórico médico acessível
```

---

## 👨‍💼 GUIA RÁPIDO PARA ADMINISTRADORES

### 1. Acesso Administrativo
```
1. Faça login com: admin.teste
2. Senha: admin123
3. Acesse funcionalidades de admin
✅ Resultado: Painel administrativo carregado
```

### 2. Painel Admin
```
1. Clique em "Admin" no menu superior
2. Acesse ferramentas administrativas disponíveis
3. Monitore atividade geral do sistema
4. Visualize estatísticas administrativas
✅ Resultado: Acesso às funcionalidades de administração
```

### 3. Funcionalidades Administrativas
```
1. No painel admin, acesse:
   - Gestão de Colaboradores (farmácias, labs, hospitais)
   - Gestão de Chaves API
   - Monitoramento de Integrações
2. Visualize atividades e status das integrações
3. Gerencie permissões e acesso ao sistema
✅ Resultado: Controle das integrações e colaboradores
```

---

## 🎛️ DASHBOARD INTERATIVO

### Painéis Arrastáveis
```
1. Todos os painéis do dashboard podem ser reorganizados
2. Passe o mouse sobre um painel para ver os controles (grip, minimizar, fechar)
3. Arraste pela barra de grip para reposicionar
4. Posições são salvas automaticamente entre sessões
5. Use "Reset Layout" para restaurar o layout padrão
```

### Dock de Painéis Minimizados
```
1. Clique no ícone "—" para minimizar um painel
2. O painel aparece como ícone no dock lateral (desktop) ou barra inferior (mobile)
3. Clique no ícone para restaurar o painel
4. O dock pode ser movido entre esquerda/direita (desktop)
5. "Restaurar todos" para reabrir todos os painéis minimizados
```

### Toolbox Unificado
```
1. Barra flutuante de ferramentas com todos os atalhos de navegação
2. Atalhos filtrados pelo papel do usuário (médico, admin, paciente)
3. Arraste para reposicionar; se solto perto das bordas, acopla automaticamente
4. Modo compacto: apenas ícones (sem rótulos)
5. Minimizar para o dock lateral via botão "—"
```

### Itens Destacáveis do Toolbox
```
1. No Toolbox, passe o mouse sobre qualquer item de navegação
2. Clique no ícone de "destacar" (seta externa) que aparece à direita
3. O item se torna um painel flutuante independente
4. Arraste pelo grip para reposicionar o painel destacado
5. Botão "—" minimiza para dock; botão "X" retorna o item ao Toolbox
6. Itens destacados persistem entre sessões
```

### Widgets Flutuantes com Minimização
```
1. Chatbot IA: botão "—" minimiza para dock → clique no ícone para restaurar
2. Notas de Estudo: botão "—" minimiza para dock → clique no ícone para restaurar
3. Análise ECG: botão "—" minimiza para dock → clique no ícone para restaurar
4. Análise Radiológica: botão "—" minimiza para dock → clique no ícone para restaurar
```

---

## 🔧 FUNCIONALIDADES DETALHADAS

### Dashboard Widgets

#### 📊 Estatísticas Principais
```
- Consultas de Hoje: Número de consultas agendadas
- Mensagens WhatsApp: Mensagens não lidas
- Agendamento IA: Atividade do assistente
- Registros Seguros: Total de prontuários
```

#### 📅 Agenda de Hoje (Widget)
```
- Visualização rápida dos compromissos do dia
- Acesso direto aos detalhes das consultas
- Status dos agendamentos
```

#### 💬 Integração WhatsApp (Widget)
```
- Mensagens recentes de pacientes
- Acesso rápido para respostas
- Indicadores de mensagens não lidas
```

#### 🤖 Assistente Clínico IA (Widget)
```
- Sugestões diagnósticas baseadas em sintomas
- Protocolos médicos recomendados
- Análise de interações medicamentosas
```

#### ✍️ Assinaturas Digitais (Widget)
```
- Documentos pendentes de assinatura
- Status de verificação
- Histórico de assinaturas
```

#### 🤝 Colaboradores Médicos (Widget)
```
- Rede de farmácias e laboratórios
- Status de integrações
- Envio de prescrições e solicitações
```

#### 🧪 Resultados de Exames (Widget)
```
- Exames recentes recebidos
- Análise automática de valores
- Alertas para resultados críticos
```

---

## 🌐 Funcionalidades Multilíngues

### Troca de Idioma
```
1. No topo da página, clique no seletor de idioma
2. Escolha entre 8 idiomas:
   - PT (Português)
   - EN (English)
   - ES (Español)
   - FR (Français)
   - IT (Italiano)
   - DE (Deutsch)
   - ZH (中文)
   - GN (Guaraní)
3. Interface atualiza automaticamente
✅ Resultado: Sistema completamente traduzido
```

---

## 🎬 Cenários de Uso Prático

### Cenário 1: Médico Iniciando o Dia
```
1. Login como médico
2. Visualizar dashboard com estatísticas
3. Verificar widget "Agenda de Hoje"
4. Ler mensagens WhatsApp no widget
5. Revisar documentos para assinatura
✅ Resultado: Visão completa do dia de trabalho
```

### Cenário 2: Consulta de Paciente
```
1. Paciente acessa com suas credenciais
2. Visualiza próximas consultas no dashboard
3. Acessa prontuários para histórico
4. Verifica comunicações recentes
✅ Resultado: Paciente informado sobre seu atendimento
```

### Cenário 3: Administração Diária
```
1. Admin acessa painel administrativo
2. Monitora atividade geral no dashboard
3. Verifica integrações no widget colaboradores
4. Analisa uso do sistema nas estatísticas
✅ Resultado: Supervisão completa do sistema
```

---

## ⚠️ Limitações Conhecidas e Status de Funcionalidades

### 🔧 APIs em Desenvolvimento:
- **WhatsApp Messages**: Endpoint parcialmente implementado (pode retornar erro 500)
- **Exam Results**: API em desenvolvimento para análise de exames
- **Patient Current ID**: Funcionalidade de paciente atual em refinamento

### 🚧 Funcionalidades Parcialmente Implementadas:
- **Videoconsultas**: Infraestrutura básica presente, interface em desenvolvimento
- **Assinaturas Digitais**: Backend funcional, interface de verificação em desenvolvimento
- **IA Diagnóstica**: Integração OpenAI configurada, interface sendo refinada
- **Análise de Exames**: Estrutura básica, análise automática em desenvolvimento

### 🔜 Roadmap de Funcionalidades:
- Interface completa de videoconsultas
- Verificação visual de assinaturas digitais
- Chat IA integrado no dashboard
- Relatórios administrativos detalhados
- Notificações push
- Backup automático com visualização

### 📋 Funcionalidades Atualmente Disponíveis:
- ✅ Autenticação e autorização por role
- ✅ Dashboard com widgets informativos
- ✅ Gestão básica de pacientes
- ✅ Sistema de agendamento
- ✅ Comunicação WhatsApp estruturada
- ✅ Prontuários médicos seguros
- ✅ Painel administrativo
- ✅ Gestão de chaves API
- ✅ Sistema multilíngue completo
- ✅ Interface responsiva

---

## 🛡️ Segurança e Conformidade

### Implementações de Segurança Atuais:
- 🔐 Autenticação baseada em sessão
- 🛡️ Controle de acesso por role (RBAC)
- 🔒 Criptografia de dados sensíveis
- 📊 Logs de auditoria básicos
- 🌐 HTTPS recomendado (obrigatório em produção)

### Indicadores Visuais:
- Badge de conformidade no header
- Indicadores de segurança no footer
- Ícones de proteção nos formulários

**Nota**: Indicadores de conformidade são elementos visuais para orientação hospitalar e não representam certificações auditadas. Para uso em produção, consulte especialistas em compliance.

---

## 📞 Suporte Técnico

### Para Desenvolvedores:
- 📁 Logs do sistema: Disponíveis via ferramentas de desenvolvimento
- 🔧 API endpoints: Documentados no código fonte
- 🗄️ Armazenamento: MemStorage (em memória) no ambiente atual; suporte a PostgreSQL via Drizzle conforme configuração do projeto

### Para Usuários:
- 💡 Interface intuitiva com navegação clara
- ❓ Labels e descrições explicativas  
- 🆘 Indicadores visuais para status do sistema
- 🔗 Link de convite para pacientes: `/join/:token` (via médico)
- 📝 **Credenciais**: Verificadas conforme script `server/scripts/create-test-users.ts`

---

## 🧪 Testando o Sistema

### Teste Rápido - Médico:
1. Login: `medico.teste` / `medico123`
2. Navegue pelos menus: Dashboard → Pacientes → Agenda → WhatsApp → Prontuários
3. Explore widgets do dashboard
4. Teste troca de idiomas

### Teste Rápido - Admin:
1. Login: `admin.teste` / `admin123`
2. Acesse todas as páginas disponíveis
3. Verifique dashboard administrativo
4. Explore funcionalidades de supervisão

### Teste Rápido - Paciente:
1. Login: `maria.santos` / `paciente123`
2. Visualize dashboard do paciente
3. Acesse prontuários
4. Verifique informações pessoais

---

## 📈 Próximos Passos

### Para Clínicas Interessadas:
1. Teste o sistema com as credenciais fornecidas
2. Avalie a adequação às suas necessidades
3. Solicite demonstração personalizada
4. Discuta implementação e treinamento

### Para Desenvolvedores:
1. Explore o código fonte
2. Contribua com melhorias
3. Reporte bugs e sugestões
4. Participate do desenvolvimento colaborativo

---

*Última atualização: Março 2026 | Versão: 3.5*
*Baseado na implementação atual do sistema*