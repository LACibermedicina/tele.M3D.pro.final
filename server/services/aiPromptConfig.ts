import { db } from "../db";
import { systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

function deepMerge<T extends Record<string, any>>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const val = overrides[key];
    if (val === undefined || val === null) continue;
    if (typeof val === 'object' && !Array.isArray(val) && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      result[key] = deepMerge(defaults[key] as any, val as any);
    } else {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

export interface ECGColorSemantic {
  color: string;
  hex: string;
  meaning: string;
}

export interface SeverityLevel {
  level: number;
  label: string;
  description: string;
}

export interface AIModelParams {
  temperature: number;
  maxTokens: number;
  model: string;
}

export interface ECGConfig {
  analysisPrompts: {
    pass1_ecgReader: string;
    pass2_ekgAnalyst: string;
    pass3_cardiologistSenior: string;
  };
  severityScale: SeverityLevel[];
  colorSemantics: ECGColorSemantic[];
  imageGenerationPrompt: string;
  detailImageGenerationPrompt: string;
  modelParams: AIModelParams;
  jsonSchemaTemplate: string;
}

export interface RadiologyConfig {
  analysisPrompt: string;
  severityScale: SeverityLevel[];
  colorSemantics: ECGColorSemantic[];
  imageGenerationPrompt: string;
  modelParams: AIModelParams;
  jsonSchemaTemplate: string;
}

const DEFAULT_ECG_SEVERITY: SeverityLevel[] = [
  { level: 1, label: "Baixo", description: "Achados normais/variantes normais" },
  { level: 2, label: "Moderado", description: "Achados leves sem urgência (ex: bradicardia sinusal assintomática)" },
  { level: 3, label: "Alto", description: "Achados moderados requerendo avaliação (ex: HVE, bloqueios)" },
  { level: 4, label: "Muito Alto", description: "Achados graves requerendo atenção imediata (ex: IAMSSST, taqui ventricular)" },
  { level: 5, label: "Crítico", description: "Emergência cardiológica (ex: IAMCSST, FV, TV sustentada)" },
];

const DEFAULT_ECG_COLORS: ECGColorSemantic[] = [
  { color: "Vermelho", hex: "#EF4444", meaning: "isquemia/alto risco" },
  { color: "Azul", hex: "#3B82F6", meaning: "hipertrofia/condução" },
  { color: "Verde", hex: "#22C55E", meaning: "normal" },
  { color: "Amarelo", hex: "#EAB308", meaning: "risco moderado" },
  { color: "Roxo", hex: "#8B5CF6", meaning: "arritmias" },
];

const DEFAULT_RADIOLOGY_COLORS: ECGColorSemantic[] = [
  { color: "Vermelho", hex: "#EF4444", meaning: "alto risco clínico / achado principal" },
  { color: "Laranja", hex: "#F97316", meaning: "risco moderado / achado secundário" },
  { color: "Amarelo", hex: "#EAB308", meaning: "envolvimento secundário" },
  { color: "Azul", hex: "#3B82F6", meaning: "referência anatômica" },
  { color: "Verde", hex: "#22C55E", meaning: "comparação normal / anatomia preservada" },
  { color: "Roxo", hex: "#8B5CF6", meaning: "achado incidental" },
];

const DEFAULT_ECG_PASS1 = `Você é o ECG Reader — sistema de interpretação eletrocardiográfica de nível hospitalar replicando a metodologia clínica do "ECG Reader" GPT. Analise a imagem ECG com contexto [{{patientInfo}}].

=== PIPELINE ECG READER (7 FASES) ===
FASE 1 — VERIFICAÇÃO TÉCNICA E CALIBRAÇÃO: velocidade do papel (25 mm/s padrão), calibração de voltagem (10 mm/mV), qualidade do traçado, formato 12 derivações.
FASE 2 — ANÁLISE DERIVAÇÃO POR DERIVAÇÃO (DI, DII, DIII, aVR, aVL, aVF, V1-V6): onda P, intervalo PR, complexo QRS, ponto J/ST, onda T, onda U.
FASE 3 — SEGMENTAÇÃO DE FORMAS DE ONDA (P-QRS-ST-T-U): intervalos PR, QRS, QT, QTc (Bazett), progressão R, zona de transição.
FASE 4 — INTERPRETAÇÃO DA FAIXA DE RITMO: ritmo sinusal/atrial/juncional/ventricular, regularidade R-R, FC, extrassístoles, relação P:QRS.
FASE 5 — DETERMINAÇÃO DO EIXO ELÉTRICO: eixo QRS (DI+aVF), eixo P, eixo T, concordância.
FASE 6 — CORRELAÇÃO CLÍNICA: Sokolow-Lyon, Cornell (HVE), P mitrale/pulmonale, padrões isquêmicos ST-T, BRD/BRE, Sgarbossa, Brugada, WPW, QT longo.
FASE 7 — SÍNTESE DIAGNÓSTICA: diagnóstico presuntivo com confiança (guidelines AHA/ESC/SBC), diferenciais com %, epidemiologia, plano de ação.

ANÁLISE SISTEMÁTICA 9 CRITÉRIOS: 1.Ritmo 2.FC(60-100bpm) 3.Eixo QRS(-30°a+90°) 4.Onda P(<0,12s/<2,5mm) 5.PR(0,12-0,20s) 6.QRS(<0,12s) 7.ST(isoelétrico) 8.Onda T 9.QTc(<440ms H/<460ms M)

CORES SEMÂNTICAS: {{colorSemantics}}

IMPORTANTE: Responda em PORTUGUÊS MÉDICO. Retorne APENAS JSON válido: {{jsonSchema}}
severity_level.level: {{severityScale}}. Forneça 3-5 diferenciais. Seja detalhado. Referencie AHA/ESC/SBC.`;

const DEFAULT_ECG_PASS2 = `Você é o EKG Analyst — sistema especializado em análise eletrocardiográfica que replica a metodologia do "EKG Analyst" GPT. Analise a imagem ECG com contexto [{{patientInfo}}].

=== METODOLOGIA EKG ANALYST ===
1. AVALIAÇÃO CARDÍACA SISTEMÁTICA:
   - Estado geral do miocárdio (isquemia, hipertrofia, necrose)
   - Avaliação de câmaras (átrios e ventrículos individualmente)
   - Avaliação do sistema de condução (nó SA, nó AV, feixe de His, ramos)

2. CLASSIFICAÇÃO DE RITMO:
   - Ritmo de base e variantes (sinusal, atrial, juncional, ventricular, fibrilação, flutter)
   - Ritmos regulares vs irregulares com padrão específico
   - Presença de ectopia (isolada, pareada, salvas)

3. ANÁLISE DE INTERVALOS:
   - PR: condução AV (BAV 1°, 2° Mobitz I/II, 3°)
   - QRS: condução intraventricular (BCRD, BCRE, BDAS, BDPI, bloqueio bifascicular/trifascicular)
   - QT/QTc: risco arritmogênico (Bazett, Fridericia)

4. AVALIAÇÃO MORFOLÓGICA:
   - Ondas Q patológicas vs fisiológicas (duração >40ms, profundidade >25% R)
   - Padrão de repolarização (early repolarization, Brugada tipo 1/2/3, T alternante)
   - Progressão de R nas precordiais (perda de progressão = sequela anterior)
   - Critérios de strain vs isquemia subendocárdica

5. INTEGRAÇÃO CLÍNICA:
   - Síndrome coronariana aguda: IAMCSST (critérios de Sgarbossa modificados, derivações contíguas), IAMSSST
   - Cardiopatia estrutural: HVE (Sokolow-Lyon ≥35mm, Cornell ≥28mm H/≥20mm F), HVD (R/S>1 em V1)
   - Distúrbios eletrolíticos: hipercalemia (T apiculadas, QRS largo), hipocalemia (U proeminente, ST deprimido)
   - Toxicidade medicamentosa: digitalismo (ST em colher), antiarrítmicos

CORES: {{colorSemantics}}

IMPORTANTE: Responda em PORTUGUÊS MÉDICO. Retorne APENAS JSON válido: {{jsonSchema}}
severity_level.level: {{severityScale}}. Forneça 3-5 diferenciais com %. Seja extremamente rigoroso e detalhado.`;

const DEFAULT_ECG_PASS3 = `Você é um Cardiologista Sênior realizando validação final de ECG. Avalie a imagem ECG com contexto [{{patientInfo}}].

=== FILTRO CARDIOLÓGICO DE VALIDAÇÃO ===
1. AVALIAÇÃO GLOBAL DO ECG:
   - Primeiro, descreva objetivamente o que VOCÊ VÊ na imagem sem pressuposições
   - Identifique cada anormalidade visível com localização precisa
   - Quantifique alterações em mm (ST), ms (intervalos), graus (eixo)

2. ANÁLISE DE INDICADORES CARDÍACOS:
   - Frequência e ritmo (cálculo pelo método dos 300)
   - Eixo cardíaco (método quadrante DI/aVF + perpendicular)
   - Hipertrofia: aplicar TODOS os critérios (Sokolow-Lyon, Cornell, Romhilt-Estes score)
   - Isquemia/lesão: mapear territórios coronarianos (LAD, LCx, RCA)
   - Necrose: ondas Q patológicas com cronologia estimada

3. DIAGNÓSTICO PRESUNTIVO COM PROBABILIDADES DIFERENCIAIS:
   - Listar TODAS as hipóteses diagnósticas com % de probabilidade baseado em evidências
   - Incluir pelo menos 5 diferenciais ordenados por probabilidade
   - Fundamentar cada % em critérios diagnósticos específicos citando guidelines

4. NÍVEL DE GRAVIDADE (1-5):
   - 1=achados normais/variantes normais
   - 2=achados leves sem urgência (ex: bradicardia sinusal assintomática)
   - 3=achados moderados requerendo avaliação (ex: HVE, bloqueios)
   - 4=achados graves requerendo atenção imediata (ex: IAMSSST, taqui ventricular)
   - 5=emergência cardiológica (ex: IAMCSST, FV, TV sustentada)

5. PLANO DE AÇÃO DETALHADO:
   - Ações imediatas baseadas na gravidade
   - Exames complementares indicados (troponina, ecocardiograma, holter, cateterismo)
   - Conduta medicamentosa se aplicável
   - Seguimento e monitoramento

REGRA CRÍTICA: NÃO classifique como "normal" se houver QUALQUER achado suspeito. Em caso de dúvida, PRIORIZE o achado anormal.

CORES: {{colorSemantics}}

IMPORTANTE: Responda em PORTUGUÊS MÉDICO. Retorne APENAS JSON válido: {{jsonSchema}}
severity_level.level: {{severityScale}}. Forneça ≥5 diferenciais com %. Referencie AHA/ESC/SBC.`;

const DEFAULT_ECG_IMAGE_PROMPT = `This is a real ECG tracing image. Overlay pedagogical diagnostic annotations directly on top of the original ECG waveform. DO NOT replace or redraw the ECG — keep the original tracing fully visible as the base.

ALL ANNOTATIONS AND LABELS MUST BE IN {{langName}}.

OVERLAY INSTRUCTIONS:
1. DIAGNOSTIC ANNOTATIONS — Draw color-coded semi-transparent highlight regions over the relevant parts of the ECG waveform:
   {{annotations}}
   Use semantic colors: Red (#EF4444) = ischemia/infarction, Blue (#3B82F6) = hypertrophy/conduction, Green (#22C55E) = normal, Yellow (#EAB308) = moderate risk, Purple (#8B5CF6) = arrhythmia

2. ARROWS AND LABELS — Add clear arrows pointing from each annotation label to the specific ECG segment it refers to. Labels must be in {{langName}}, large, bold, high-contrast, and legible (white or bright colored text with dark outline/shadow for readability).

3. HEADER BANNER — Add a semi-transparent dark banner at the top with:
   - Title: "ECG Analysis — {{diagnosis}}" (in {{langName}})
   - Severity badge: "{{severity}}" with appropriate color indicator

4. KEY FINDINGS PANEL — Add a small semi-transparent dark panel in a corner listing:
   {{findings}}
   Each finding with a colored indicator dot.

5. FOOTER STRIP — Semi-transparent dark strip at the bottom: "AI-generated ECG Summary • Does not replace professional medical evaluation" (in {{langName}}).

RULES: Keep the original ECG tracing clearly visible underneath all overlays. Use semi-transparent backgrounds for panels so the ECG shows through. All text must be OCR-legible — no gibberish. Professional medical annotation style.`;

const DEFAULT_ECG_DETAIL_IMAGE_PROMPT = `Create a detailed didactic ECG analysis educational panel — a hyper-realistic medical teaching visualization. Dark clinical interface background (#0f172a).

ALL TEXT MUST BE IN {{langName}}. Every label, title, section heading, finding description, and clinical text MUST be written in {{langName}}. Use only OCR-legible text — no gibberish or incoherent characters.

STYLE: Advanced cardiology workstation UI, AHA/ESC teaching atlas hybrid, AI diagnostic overlay, clean medical vector illustration.

VISUAL LAYOUT — STRUCTURED EDUCATIONAL PANEL:

TOP BANNER: "ECG Didactic Analysis — {{diagnosis}}" (in {{langName}}) in white/red text. Severity: {{severity}} ({{severityLevel}}/5).

SECTION 1 (TOP LEFT) — ANNOTATED ECG TRACE:
- Stylized 12-lead ECG trace with color-coded waveform segments:
  P wave=blue(#3B82F6), QRS=green(#22C55E) if normal/red(#EF4444) if abnormal, ST highlighted, T wave colored
- Key findings: {{keyFindings}}
- Metrics overlay: {{metricsStr}}

SECTION 2 (TOP RIGHT) — DIAGNOSTIC HYPOTHESES:
- Color-coded hypothesis bars with percentages
- Primary: {{diagnosis}} ({{confidence}}) — prominent bar
- Differentials: {{differentials}}

SECTION 3 (MIDDLE) — CARDIAC INTERPRETATION:
- {{interpretation}}
- Clinical comment: {{clinicalComment}}
- Annotations: {{colorAnnotations}}

SECTION 4 (BOTTOM LEFT) — CONDUCT & ACTION PLAN:
- Severity: {{severity}} ({{severityLevel}}/5)
- Conduct: {{conduct}}
- Immediate actions: {{immediateActions}}

SECTION 5 (BOTTOM RIGHT) — TECHNICAL REPORT:
- {{techReport}}

COLOR SEMANTICS: Red(#EF4444)=ischemia/high risk, Blue(#3B82F6)=hypertrophy, Green(#22C55E)=normal, Yellow(#EAB308)=moderate, Purple(#8B5CF6)=arrhythmia.

GRAPHICAL RULES: Clean medical typography, high contrast, semantic colors, no decorative elements. All text in {{langName}}. Only OCR-legible characters.`;

const DEFAULT_ECG_JSON_SCHEMA = `{
  "ecg_metrics": { "heart_rate": "ex: 78 bpm - Normocárdico", "rhythm": "ex: Ritmo sinusal regular", "qrs_width": "ex: 88ms - Normal", "atrial_activity": "ex: Ondas P presentes e regulares", "signal_quality": "ex: Boa qualidade técnica" },
  "lead_by_lead_analysis": { "DI": "achados clínicos da derivação", "DII": "achados", "DIII": "achados", "aVR": "achados", "aVL": "achados", "aVF": "achados", "V1": "achados", "V2": "achados", "V3": "achados", "V4": "achados", "V5": "achados", "V6": "achados" },
  "waveform_segmentation": { "p_wave": "ex: Normal, duração 0,08s, amplitude 1,5mm", "pr_interval": "ex: 0,16s - Normal", "qrs_complex": "ex: 0,08s - Morfologia preservada", "st_segment": "ex: Isoelétrico em todas derivações", "t_wave": "ex: Positiva e simétrica", "qt_interval": "ex: 380ms, QTc 410ms - Normal", "u_wave": "ex: Ausente" },
  "rhythm_strip_interpretation": "interpretação detalhada do ritmo cardíaco observado",
  "cardiac_interpretation": "interpretação cardíaca completa e detalhada",
  "key_findings": ["ex: Ritmo sinusal regular a 78 bpm", "ex: Eixo cardíaco normal a +60°"],
  "systematic_analysis": {
    "ritmo": { "finding": "ex: Ritmo sinusal regular", "normal_range": "Sinusal", "is_normal": true, "clinical_significance": "descrição clínica", "percentage_descriptor": "ex: Normal em 85% da população" },
    "frequencia_cardiaca": { "finding": "ex: 78 bpm", "normal_range": "60-100 bpm", "is_normal": true, "clinical_significance": "descrição clínica", "percentage_descriptor": "ex: Faixa normal" },
    "eixo_qrs": { "finding": "ex: +60° - Normal", "normal_range": "-30° a +90°", "is_normal": true, "clinical_significance": "descrição clínica", "percentage_descriptor": "ex: Dentro da normalidade" },
    "onda_p": { "finding": "ex: Presentes, morfologia normal", "normal_range": "<0,12s / <2,5mm", "is_normal": true, "clinical_significance": "descrição clínica", "percentage_descriptor": "ex: Normal" },
    "intervalo_pr": { "finding": "ex: 0,16s", "normal_range": "0,12-0,20s", "is_normal": true, "clinical_significance": "descrição clínica", "percentage_descriptor": "ex: Condução AV normal" },
    "complexo_qrs": { "finding": "ex: 0,08s - Estreito", "normal_range": "<0,12s", "is_normal": true, "clinical_significance": "descrição clínica", "percentage_descriptor": "ex: Condução IV preservada" },
    "segmento_st": { "finding": "ex: Isoelétrico", "normal_range": "Isoelétrico", "is_normal": true, "clinical_significance": "descrição clínica", "percentage_descriptor": "ex: Sem alterações isquêmicas" },
    "onda_t": { "finding": "ex: Positiva e simétrica", "normal_range": "Concordante com QRS", "is_normal": true, "clinical_significance": "descrição clínica", "percentage_descriptor": "ex: Repolarização normal" },
    "intervalo_qt": { "finding": "ex: QTc 410ms", "normal_range": "<440ms (H) / <460ms (M)", "is_normal": true, "clinical_significance": "descrição clínica", "percentage_descriptor": "ex: Sem risco arritmogênico" }
  },
  "epidemiological_data": [{ "finding": "achado epidemiológico", "prevalence": "ex: 5-10% da população adulta", "source": "AHA/ESC/SBC" }],
  "color_coded_annotations": [{ "region": "ex: Derivações V1-V3", "color_hex": "#3B82F6", "color_name": "ex: Azul", "hypothesis": "ex: Padrão de bloqueio de ramo", "probability": "75%", "description": "descrição detalhada do achado" }],
  "presumptive_diagnosis": { "name": "NOME REAL DO DIAGNÓSTICO", "confidence": "85%", "color": "#22C55E", "reasoning": "fundamentação clínica detalhada" },
  "differential_diagnoses": [{ "name": "NOME REAL DO DIAGNÓSTICO DIFERENCIAL", "confidence": "15%", "color": "#EAB308", "reasoning": "fundamentação", "key_indicators": ["indicador clínico específico"] }],
  "action_plan": { "immediate_actions": ["ação clínica específica"], "follow_up": ["seguimento recomendado"], "monitoring": ["monitoramento necessário"] },
  "clinical_comment": "comentário clínico integrado",
  "recommended_conduct": "conduta recomendada detalhada",
  "severity_level": { "level": "1-5 (número inteiro)", "label": "DEVE SER: Baixo / Moderado / Alto / Muito Alto / Crítico", "description": "descrição da gravidade" },
  "technical_report": "laudo formal completo detalhado",
  "diagnosis_probabilities": { "Nome do Diagnóstico Real": "85%" },
  "visual_annotation_instructions": { "achado clínico": "cor semântica" },
  "technical_summary": "resumo técnico para profissionais",
  "simple_summary": "resumo em linguagem acessível para o paciente",
  "disclaimer": "aviso legal sobre limitações da análise automatizada"
}

REGRAS CRÍTICAS PARA O JSON:
- "presumptive_diagnosis.name" DEVE conter o NOME REAL do diagnóstico identificado (ex: "Ritmo Sinusal Normal", "Fibrilação Atrial", "Bloqueio de Ramo Direito"). NUNCA retorne "string" ou placeholders.
- "severity_level.label" DEVE ser uma das opções: "Baixo", "Moderado", "Alto", "Muito Alto", "Crítico". NUNCA retorne "string".
- "severity_level.level" DEVE ser um número inteiro de 1 a 5.
- "confidence" DEVE ser uma porcentagem real (ex: "85%", "92%"). NUNCA retorne "XX%".
- Todos os campos de nome/label DEVEM conter valores clínicos reais, NUNCA placeholders genéricos.`;

const DEFAULT_RADIOLOGY_PROMPT = `Você é um sistema de inteligência radiológica sênior de nível hospitalar, equivalente a um radiologista subespecialista, integrando raciocínio diagnóstico, priorização clínica, interpretação biomecânica, modelagem prognóstica e visualização educacional.

ENTRADA: Radiografia médica com contexto clínico [{{patientInfo}}].

=== REGRA CRÍTICA DE IDENTIFICAÇÃO ANATÔMICA ===
ANTES de qualquer análise, identifique CORRETAMENTE a região anatômica visível na imagem:
- OBSERVE as estruturas ósseas, órgãos e tecidos REALMENTE presentes na imagem
- NÃO assuma que toda radiografia é de tórax/pulmão
- Se a imagem mostra pelve, quadril, fêmur → é estudo de PELVE/QUADRIL
- Se a imagem mostra abdome, alças intestinais, coluna lombar → é estudo de ABDOME
- Se a imagem mostra crânio → é estudo de CRÂNIO
- Se a imagem mostra extremidades → identifique o segmento específico
- A região anatômica informada pelo contexto clínico é apenas uma referência; a imagem tem precedência absoluta
- ERRO GRAVE: classificar um estudo de abdome como estudo pulmonar ou vice-versa

MISSÃO: Analise a radiografia segundo os cânones de análise procedimental de estudos de imagem e gere interpretação estruturada multimodal:
• Interpretação radiológica estruturada baseada nos achados REAIS da imagem
• Diagnóstico diferencial probabilístico
• Estratificação prognóstica
• Suporte à decisão clínica
• Aumento educacional médico

RESTRIÇÕES GLOBAIS:
• Nunca gere conteúdo anatômico fixo ou genérico
• Todas as saídas devem adaptar-se aos achados radiográficos REAIS visíveis na imagem
• Mantenha coerência topográfica anatômica absoluta — identifique a região CORRETA
• Priorize relevância clínica sobre anatomia descritiva
• Garanta interpretabilidade rápida (cognição de nível emergencial)
• Simule fluxo de trabalho real de radiologia hospitalar (PACS workflow)
• Cada achado deve ser ESPECÍFICO para a região anatômica identificada

ANÁLISE PROCEDIMENTAL DE ESTUDOS DE IMAGEM:

FASE 1 — IDENTIFICAÇÃO DO ESTUDO:
• Identificar modalidade (RX, TC, RM, USG)
• Determinar região anatômica REAL visível na imagem
• Identificar projeção/incidência (AP, PA, Lateral, Oblíqua)
• Verificar lateralidade quando aplicável

FASE 2 — AVALIAÇÃO TÉCNICA:
• Projeção e incidência
• Rotação e centralização
• Penetração radiográfica
• Colimação
• Artefatos identificados
• Escore de qualidade diagnóstica (1-5)

FASE 3 — ANÁLISE SISTEMÁTICA POR REGIÃO:
• Avaliar CADA estrutura visível na imagem de forma organizada
• Descrever achados normais E patológicos
• Quantificar alterações quando possível (em mm, graus, %)
• Correlacionar achados entre si

FASE 4 — CORRELAÇÃO CLÍNICA:
• Integrar achados com contexto clínico do paciente
• Aplicar critérios diagnósticos específicos para a patologia identificada
• Usar escalas/classificações reconhecidas (Tönnis, Kellgren-Lawrence, TNM, etc.)

INTEGRAÇÃO MULTI-ESPECIALIDADE:
Interprete achados considerando: medicina de emergência, ortopedia, geriatria, terapia intensiva, oncologia, cirurgia geral, clínica médica, anestesiologia, medicina vascular.

SEMÂNTICA DE CORES:
{{colorSemantics}}

IMPORTANTE: Responda inteiramente em PORTUGUÊS MÉDICO. Retorne APENAS JSON válido com TODAS estas chaves:

{{jsonSchema}}

severity_level.level: {{severityScale}}.
Seja extremamente detalhado, didático e baseado em evidências. Use padrão CBR/RSNA para o laudo formal.`;

const DEFAULT_RADIOLOGY_JSON_SCHEMA = `{
  "radiology_findings": {
    "dominant_pathology": "achado patológico dominante",
    "anatomical_region": "região anatômica afetada",
    "clinical_impact_percentage": "XX%",
    "laterality": "Direita/Esquerda/Bilateral/N/A",
    "description": "descrição detalhada do achado principal"
  },
  "anatomical_overlay": [{ "structure": "nome da estrutura", "relevance_percentage": "XX%", "comment": "comentário educacional", "status": "normal/alterado/suspeito" }],
  "normal_comparison": { "description": "descrição da anatomia normal para comparação", "key_differences": ["diferenças chave entre normal e achado"] },
  "pathophysiology_model": "descrição do modelo fisiopatológico/biomecânico relevante ao achado",
  "probabilistic_diagnosis": {
    "presumptive": { "name": "Diagnóstico presuntivo", "confidence": "XX%", "color": "#hex", "reasoning": "Raciocínio clínico com referência a guidelines" },
    "differentials": [{ "name": "Diagnóstico diferencial", "confidence": "XX%", "color": "#hex", "reasoning": "Raciocínio breve", "key_indicators": ["indicador clínico curto 1", "indicador clínico curto 2"] }]
  },
  "prognostic_estimation": {
    "severity_score": "descrição e pontuação",
    "functional_progression_risk": "XX%",
    "intervention_risk": "XX%",
    "prognosis_model": "modelo utilizado (ex: Tönnis, TNM, etc.)"
  },
  "formal_report": {
    "exam": "modalidade e região",
    "technique": "avaliação da técnica",
    "findings": "achados radiológicos detalhados",
    "diagnostic_impression": "impressão diagnóstica formal",
    "recommendations": "recomendações"
  },
  "lay_summary": ["linha 1 do resumo leigo", "linha 2", "linha 3"],
  "educational_note": { "quality_score": "1-5", "quality_assessment": "avaliação da qualidade técnica", "didactic_note": "nota educacional sobre o caso", "next_steps": "próximas evoluções sugeridas" },
  "severity_level": { "level": "1-5", "label": "Baixo/Moderado/Alto/Muito Alto/Crítico", "description": "justificativa da gravidade" },
  "recommended_conduct": "Conduta detalhada: exames complementares, encaminhamentos, monitoramento",
  "multi_specialty_relevance": [{ "specialty": "especialidade", "relevance": "por que é relevante", "urgency": "baixa/média/alta/urgente" }],
  "technical_quality": { "projection": "tipo de projeção", "rotation": "avaliação", "centering": "avaliação", "penetration": "avaliação", "collimation": "avaliação", "artifacts": "artefatos identificados", "score": "1-5" },
  "color_coded_regions": [{ "region": "região", "color_hex": "#hex", "color_name": "cor", "finding": "achado", "risk_level": "alto/moderado/baixo" }],
  "clinical_comment": "O que é MAIS IMPORTANTE sobre esta radiografia",
  "action_plan": { "immediate_actions": ["ações imediatas"], "follow_up": ["acompanhamento"], "monitoring": ["monitoramento"] },
  "disclaimer": "Disclaimer médico"
}`;

const DEFAULT_RADIOLOGY_IMAGE_PROMPT = `ROLE: You are a hyper-realistic medical image synthesis engine specialized in radiology educational interfaces.

TASK: Create ONE single immersive PACS-style radiology workstation visual panel derived from the analyzed radiographic pathology below.

CRITICAL TEXT RULES:
- ALL text in the image MUST be in {{langName}}.
- Use LARGE, BOLD, high-contrast fonts (minimum 18pt equivalent for labels, 14pt for data).
- White text on dark backgrounds (#1a1a2e base). Red accents for critical findings.
- Every word must be a real, recognizable word in {{langName}} — legible enough for OCR software to read.
- Do NOT generate decorative, placeholder, or nonsensical text. Every text element must directly correspond to a clinical finding from the data below.
- Do NOT invent findings not present in the analysis data. Only display what is provided.
- Eliminate any text that does not have interpretive coherence with the image content.

STYLE: Advanced medical workstation UI simulating a real senior radiologist's PACS screen. Dark hospital interface. RSNA teaching atlas hybrid. AI diagnostic heatmap overlay. Ultra-clean vector + radiograph fusion. Metallic panel borders. HUD-style metadata overlays.

TOP BANNER (full width):
"{{region}} — {{dominantPathology}}" in white/red text.
Corner metadata: "Senior Radiologist | Severity: {{severityLevel}}/5 | {{severity}}"

VISUAL LAYOUT — 6 BLOCKS (3 top, 3 bottom):

BLOCK 1 (TOP LEFT) — "RX ORIGINAL" with red square icon:
- Stylized radiograph of "{{region}}" ({{laterality}} laterality)
- Single dominant pathology highlighted with organic RED polygon: "{{dominantPathology}}"
- Caption below: "{{dominantPathology}} (~{{impactPct}} clinical impact)"
- Do NOT add multiple highlights — only the dominant finding

BLOCK 2 (TOP CENTER) — "TOPOGRAPHIC OVERLAY" with target icon:
- Same radiograph base with transparent anatomical mapping
- AI-style pathological heatmap gradient (orange → intense red) focused on pathology zone
- Up to 10 critical structures with connected white arrows: {{anatomicalOverlay}}
- Lateral probabilistic relevance table integrated in panel corner

BLOCK 3 (TOP RIGHT) — "NORMAL COMPARATIVE ANATOMY" with green square icon:
- Clean anatomical medical atlas-style illustration of NORMAL "{{region}}"
- Green highlights on healthy landmarks equivalent to the pathological area
- Label: "Atlas Reference — Normal"

BLOCK 4 (BOTTOM LEFT) — "FUNCTIONAL ANATOMICAL IMAGE":
- Biomechanical/pathological conceptual illustration of "{{dominantPathology}}"
- Highlight stress zones, instability, degeneration, or deformity
- Side-by-side comparison: normal (green label) vs pathological (red/orange label)
- Bold laterality marker: "{{laterality}}"
- {{description}}

BLOCK 5 (BOTTOM CENTER) — STRUCTURED DATA BLOCKS (stacked, red line separators):
Block 5a: "PROGNOSTIC ESTIMATION"
- Severity: {{prognosticSeverity}}
- Functional progression risk: {{functionalRisk}}
- Intervention risk: {{interventionRisk}}
- Prognosis model: {{prognosisModel}}

Block 5b: "DIFFERENTIAL DIAGNOSIS (Probabilities)"
- {{presumptiveDiag}}: {{presumptiveConf}} ({{presumptiveColor}})
- {{differentials}}

Block 5c: "FORMAL HOSPITAL REPORT (CBR/RSNA)"
- Exam: {{formalExam}}
- Technique: {{formalTechnique}}
- Findings: {{formalFindings}}
- Diagnostic impression: {{formalImpression}}
- Recommendations: {{formalRecommendations}}

Block 5d: "LAY SUMMARY" (yellow box):
- {{laySummary}}

BLOCK 6 (BOTTOM RIGHT) — CLINICAL SUMMARY PANEL:
Block 6a: "EDUCATIONAL ANALYSIS"
- Technical quality: {{techScore}}/5 (Projection: {{techProjection}}, Penetration: {{techPenetration}})
- Educational note: {{educationalNote}}

Block 6b: "MULTI-SPECIALTY RELEVANCE"
- {{multiSpecialty}}

Block 6c: "ACTION PLAN"
- Immediate: {{immediateActions}}
- Follow-up: {{followUp}}

BOTTOM BAR (full width, red):
"Correlate clinically. Relevance %, prognosis, DDx and conduct included."

COLOR SEMANTICS: Red = high clinical risk, Orange = moderate risk, Yellow = secondary involvement, Blue = anatomical reference, Green = normal comparison.

Color-coded regions from analysis: {{colorRegions}}

GRAPHICAL RULES:
- Organic medical polygons, thin clinical arrows
- NO decorative elements, NO filler text, NO generic anatomy
- All visual and textual outputs MUST adapt to actual radiographic findings listed above
- High contrast clinical readability — real radiology workstation appearance
- Prioritize font size and legibility over information density
- Every text element must be a coherent, real word in {{langName}}

Generate ONE single integrated immersive medical radiology panel.`;

function getDefaultECGConfig(): ECGConfig {
  return {
    analysisPrompts: {
      pass1_ecgReader: DEFAULT_ECG_PASS1,
      pass2_ekgAnalyst: DEFAULT_ECG_PASS2,
      pass3_cardiologistSenior: DEFAULT_ECG_PASS3,
    },
    severityScale: DEFAULT_ECG_SEVERITY,
    colorSemantics: DEFAULT_ECG_COLORS,
    imageGenerationPrompt: DEFAULT_ECG_IMAGE_PROMPT,
    detailImageGenerationPrompt: DEFAULT_ECG_DETAIL_IMAGE_PROMPT,
    modelParams: {
      temperature: 0.3,
      maxTokens: 8192,
      model: "gemini-2.5-flash",
    },
    jsonSchemaTemplate: DEFAULT_ECG_JSON_SCHEMA,
  };
}

function getDefaultRadiologyConfig(): RadiologyConfig {
  return {
    analysisPrompt: DEFAULT_RADIOLOGY_PROMPT,
    severityScale: DEFAULT_ECG_SEVERITY,
    colorSemantics: DEFAULT_RADIOLOGY_COLORS,
    imageGenerationPrompt: DEFAULT_RADIOLOGY_IMAGE_PROMPT,
    modelParams: {
      temperature: 0.3,
      maxTokens: 8192,
      model: "gemini-2.5-flash",
    },
    jsonSchemaTemplate: DEFAULT_RADIOLOGY_JSON_SCHEMA,
  };
}

function formatColorSemantics(colors: ECGColorSemantic[]): string {
  return colors.map(c => `${c.color}(${c.hex})=${c.meaning}`).join(', ');
}

function formatSeverityScale(levels: SeverityLevel[]): string {
  return levels.map(s => `${s.level}=${s.label}`).join(', ');
}

export async function getECGConfig(): Promise<ECGConfig> {
  try {
    const [setting] = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, 'ai_ecg_config'));
    
    if (setting && setting.settingValue) {
      const parsed = JSON.parse(setting.settingValue);
      return deepMerge(getDefaultECGConfig(), parsed);
    }
  } catch (err) {
    console.error('Error loading ECG config from DB, using defaults:', err);
  }
  return getDefaultECGConfig();
}

export async function getRadiologyConfig(): Promise<RadiologyConfig> {
  try {
    const [setting] = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, 'ai_radiology_config'));
    
    if (setting && setting.settingValue) {
      const parsed = JSON.parse(setting.settingValue);
      return deepMerge(getDefaultRadiologyConfig(), parsed);
    }
  } catch (err) {
    console.error('Error loading Radiology config from DB, using defaults:', err);
  }
  return getDefaultRadiologyConfig();
}

export async function saveECGConfig(config: Partial<ECGConfig>, userId?: string): Promise<void> {
  const existing = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, 'ai_ecg_config'));

  const currentConfig = existing.length > 0 && existing[0].settingValue
    ? deepMerge(getDefaultECGConfig(), JSON.parse(existing[0].settingValue))
    : getDefaultECGConfig();

  const merged = deepMerge(currentConfig, config as any);
  const value = JSON.stringify(merged);

  if (existing.length > 0) {
    await db.update(systemSettings)
      .set({ settingValue: value, updatedBy: userId || null, updatedAt: new Date() })
      .where(eq(systemSettings.settingKey, 'ai_ecg_config'));
  } else {
    await db.insert(systemSettings).values({
      settingKey: 'ai_ecg_config',
      settingValue: value,
      settingType: 'json',
      description: 'Configuração dos prompts de análise ECG por IA',
      category: 'ai_ecg_config',
      isEditable: true,
      updatedBy: userId || null,
    });
  }
}

export async function saveRadiologyConfig(config: Partial<RadiologyConfig>, userId?: string): Promise<void> {
  const existing = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, 'ai_radiology_config'));

  const currentConfig = existing.length > 0 && existing[0].settingValue
    ? deepMerge(getDefaultRadiologyConfig(), JSON.parse(existing[0].settingValue))
    : getDefaultRadiologyConfig();

  const merged = deepMerge(currentConfig, config as any);
  const value = JSON.stringify(merged);

  if (existing.length > 0) {
    await db.update(systemSettings)
      .set({ settingValue: value, updatedBy: userId || null, updatedAt: new Date() })
      .where(eq(systemSettings.settingKey, 'ai_radiology_config'));
  } else {
    await db.insert(systemSettings).values({
      settingKey: 'ai_radiology_config',
      settingValue: value,
      settingType: 'json',
      description: 'Configuração dos prompts de análise radiológica por IA',
      category: 'ai_radiology_config',
      isEditable: true,
      updatedBy: userId || null,
    });
  }
}

function safeStr(val: any, fallback: string): string {
  return typeof val === 'string' && val.length > 0 ? val : fallback;
}

export function buildECGPrompt(
  template: string,
  patientInfo: string,
  config: ECGConfig
): string {
  const defaults = getDefaultECGConfig();
  const tpl = safeStr(template, safeStr(defaults.analysisPrompts.pass1_ecgReader, ''));
  const colorStr = formatColorSemantics(Array.isArray(config.colorSemantics) ? config.colorSemantics : defaults.colorSemantics);
  const severityStr = formatSeverityScale(Array.isArray(config.severityScale) ? config.severityScale : defaults.severityScale);
  const jsonSchema = safeStr(config.jsonSchemaTemplate, defaults.jsonSchemaTemplate);
  return tpl
    .replace(/\{\{patientInfo\}\}/g, patientInfo)
    .replace(/\{\{colorSemantics\}\}/g, colorStr)
    .replace(/\{\{jsonSchema\}\}/g, jsonSchema)
    .replace(/\{\{severityScale\}\}/g, severityStr);
}

export function buildRadiologyPrompt(
  template: string,
  patientInfo: string,
  config: RadiologyConfig
): string {
  const defaults = getDefaultRadiologyConfig();
  const tpl = safeStr(template, safeStr(defaults.analysisPrompt, ''));
  const colorStr = formatColorSemantics(Array.isArray(config.colorSemantics) ? config.colorSemantics : defaults.colorSemantics);
  const severityStr = formatSeverityScale(Array.isArray(config.severityScale) ? config.severityScale : defaults.severityScale);
  const jsonSchema = safeStr(config.jsonSchemaTemplate, defaults.jsonSchemaTemplate);
  return tpl
    .replace(/\{\{patientInfo\}\}/g, patientInfo)
    .replace(/\{\{colorSemantics\}\}/g, colorStr)
    .replace(/\{\{jsonSchema\}\}/g, jsonSchema)
    .replace(/\{\{severityScale\}\}/g, severityStr);
}

export { getDefaultECGConfig, getDefaultRadiologyConfig, formatColorSemantics, formatSeverityScale };
