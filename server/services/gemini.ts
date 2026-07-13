import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { db } from "../db";
import { chatbotReferences } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getECGConfig, getRadiologyConfig, buildECGPrompt, buildRadiologyPrompt, formatColorSemantics, formatSeverityScale } from "./aiPromptConfig";

let genAI: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

// Called by the /instalar installer after credentials change so the cached
// clients are rebuilt from the new environment on next use.
export function resetGeminiClients(): void {
  genAI = null;
  openaiClient = null;
}

function getGeminiClient(): GoogleGenerativeAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

function getOpenAIFallback(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
    });
  }
  return openaiClient;
}

function isGeminiUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') ||
    msg.includes('GEMINI_API_KEY') || msg.includes('not found for API') || msg.includes('Too Many Requests');
}

export interface DiagnosticHypothesis {
  condition: string;
  probability: number;
  reasoning: string;
  ministryGuidelines?: string;
}

export interface SchedulingRequest {
  patientMessage: string;
  patientName?: string;
  requestedDate?: string;
  requestedTime?: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface SchedulingResponse {
  isSchedulingRequest: boolean;
  suggestedAppointment?: {
    date: string;
    time: string;
    type: string;
  };
  response: string;
  requiresHumanIntervention: boolean;
}

async function generateWithJSON(prompt: string): Promise<any> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    return JSON.parse(response);
  } catch (error) {
    if (isGeminiUnavailable(error)) {
      console.log('Gemini unavailable, falling back to OpenAI integration');
      return generateWithJSONOpenAI(prompt);
    }
    throw error;
  }
}

async function generateWithJSONOpenAI(prompt: string): Promise<any> {
  const client = getOpenAIFallback();
  const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return JSON.parse(response.choices[0].message.content || '{}');
}

async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ 
      model: "gemini-2.0-flash"
    });
    const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
    const result = await model.generateContent(fullPrompt);
    return result.response.text();
  } catch (error) {
    if (isGeminiUnavailable(error)) {
      console.log('Gemini unavailable, falling back to OpenAI integration');
      return generateTextOpenAI(prompt, systemInstruction);
    }
    throw error;
  }
}

async function generateTextOpenAI(prompt: string, systemInstruction?: string): Promise<string> {
  const client = getOpenAIFallback();
  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });
  const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages,
  });
  return response.choices[0].message.content || '';
}

export class GeminiService {
  async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    return generateText(prompt, systemInstruction);
  }

  async generateWithJSON(prompt: string): Promise<any> {
    return generateWithJSON(prompt);
  }

  async analyzeWhatsappMessage(message: string, patientHistory?: string): Promise<{
    isSchedulingRequest: boolean;
    isClinicalQuestion: boolean;
    response: string;
    suggestedAction?: string;
  }> {
    try {
      const prompt = `
        Você é uma IA assistente médica integrada ao WhatsApp. Analise a mensagem do paciente e determine:
        
        1. Se é uma solicitação de agendamento
        2. Se é uma pergunta clínica
        3. Forneça uma resposta apropriada baseada nas diretrizes do Ministério da Saúde
        
        Mensagem do paciente: "${message}"
        ${patientHistory ? `Histórico do paciente: ${patientHistory}` : ''}
        
        Responda em JSON com os campos: isSchedulingRequest, isClinicalQuestion, response, suggestedAction
      `;

      return await generateWithJSON(prompt);
    } catch (error) {
      console.error('Gemini analysis error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to analyze WhatsApp message'
      });
      return {
        isSchedulingRequest: false,
        isClinicalQuestion: false,
        response: error instanceof Error && error.message.includes('GEMINI_API_KEY')
          ? 'Funcionalidade de IA temporariamente indisponível. Por favor, entre em contato diretamente com nosso suporte.'
          : 'Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente.',
      };
    }
  }

  async processSchedulingRequest(
    message: string, 
    availableDoctors?: Array<{ 
      doctorId: string; 
      doctorName: string; 
      availableSlots: Array<{ dateIso: string; time: string; label: string }> 
    }>
  ): Promise<SchedulingResponse> {
    try {
      let availabilityInfo = '';
      let slotsMetadata: Record<string, { dateIso: string; time: string }> = {};
      
      if (availableDoctors && availableDoctors.length > 0) {
        availabilityInfo = 'Médicos disponíveis com horários estruturados:\n';
        availableDoctors.forEach(doctor => {
          availabilityInfo += `\n- Dr(a). ${doctor.doctorName} (ID: ${doctor.doctorId})\n`;
          availabilityInfo += '  Horários disponíveis:\n';
          doctor.availableSlots.forEach(slot => {
            const slotKey = `${doctor.doctorId}_${slot.dateIso}_${slot.time}`;
            slotsMetadata[slotKey] = { dateIso: slot.dateIso, time: slot.time };
            availabilityInfo += `    - ${slot.label} [dateIso: ${slot.dateIso}, time: ${slot.time}]\n`;
          });
        });
      } else {
        availabilityInfo = 'Nenhum médico disponível no momento. Solicite que o paciente escolha outra data.';
      }

      const prompt = `
        Você é um assistente de agendamento médico inteligente. Analise a solicitação de agendamento do paciente e sugira o melhor médico e horário disponível baseado na DISPONIBILIDADE REAL dos médicos.
        
        Mensagem do paciente: "${message}"
        
        ${availabilityInfo}
        
        IMPORTANTE: 
        - Você DEVE sugerir apenas horários que estão REALMENTE disponíveis na lista acima
        - Se não houver horários disponíveis, informe o paciente e peça para escolher outra data
        - Sempre inclua o ID do médico na resposta
        - COPIE EXATAMENTE o dateIso e time do horário escolhido - não invente valores
        - O campo dateIso já está no formato YYYY-MM-DD correto
        - O campo time já está no formato HH:MM correto
        
        Forneça uma resposta em JSON com:
        - isSchedulingRequest: boolean (sempre true se for uma solicitação de agendamento)
        - suggestedAppointment: { dateIso: string (copie o valor exato do horário escolhido), time: string (copie o valor exato do horário escolhido), doctorId: string, doctorName: string, type: string }
        - response: string (resposta amigável para o paciente explicando a sugestão, use o label do horário para melhor comunicação)
        - requiresHumanIntervention: boolean (true se não houver disponibilidade)
      `;

      const result = await generateWithJSON(prompt);
      return {
        ...result,
        isSchedulingRequest: true
      };
    } catch (error) {
      console.error('Gemini scheduling error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to process scheduling request'
      });
      return {
        isSchedulingRequest: true,
        response: 'Desculpe, não foi possível processar sua solicitação de agendamento no momento. Por favor, tente novamente ou entre em contato com nossa equipe.',
        requiresHumanIntervention: true,
      };
    }
  }

  async generateDiagnosticHypotheses(symptoms: string, patientHistory: string): Promise<DiagnosticHypothesis[]> {
    try {
      const prompt = `
        Como um assistente médico especializado, analise os sintomas e histórico do paciente para gerar hipóteses diagnósticas baseadas nas diretrizes do Ministério da Saúde brasileiro.
        
        Sintomas: "${symptoms}"
        Histórico do paciente: "${patientHistory}"
        
        Forneça até 5 hipóteses diagnósticas mais prováveis em JSON com:
        - hypotheses: array de objetos, cada um com:
          - condition: nome da condição
          - probability: probabilidade em porcentagem (0-100)
          - reasoning: justificativa clínica
          - ministryGuidelines: referência às diretrizes do MS quando aplicável
        
        Responda com um objeto JSON contendo o campo "hypotheses".
      `;

      const result = await generateWithJSON(prompt);
      return result.hypotheses || [];
    } catch (error) {
      console.error('Gemini diagnostic error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to generate diagnostic hypotheses'
      });
      throw error;
    }
  }

  async analyzeSymptomsForMedicalRecord(symptoms: string, patientHistory: string): Promise<{
    diagnosis: string;
    treatment: string;
    prescription: string;
    hypotheses: DiagnosticHypothesis[];
    recommendations: string;
  }> {
    try {
      const prompt = `
        Como um assistente médico especializado em medicina brasileira, analise os sintomas e histórico do paciente para auxiliar o médico na redação do prontuário médico.
        
        Sintomas apresentados: "${symptoms}"
        Histórico do paciente: "${patientHistory}"
        
        IMPORTANTE: Esta é uma análise de suporte. O médico é responsável pela decisão final.
        
        Forneça uma análise completa em JSON com:
        
        1. diagnosis: Diagnóstico sugerido (hipótese diagnóstica principal com justificativa clínica detalhada)
        
        2. treatment: Plano de tratamento sugerido (incluindo medidas não-farmacológicas, orientações gerais, e quando necessário retorno)
        
        3. prescription: Prescrição médica sugerida (medicamentos com dosagem, via de administração, frequência e duração - use nomenclatura técnica adequada)
        
        4. hypotheses: Array de hipóteses diagnósticas diferenciais, cada uma com:
           - condition: nome da condição
           - probability: probabilidade (0-100)
           - reasoning: justificativa
           - ministryGuidelines: referência às diretrizes do MS quando aplicável
        
        5. recommendations: Recomendações adicionais (exames complementares, sinais de alerta, quando procurar pronto-socorro)
        
        Use terminologia médica apropriada e siga as diretrizes da OMS, protocolos do Ministério da Saúde do Brasil (Cadernos de Atenção Básica, PCDT/CONITEC) e, para condições psiquiátricas, os critérios diagnósticos do DSM-5/DSM-5-TR complementados pelas diretrizes da ABP e mhGAP-OMS.
        Responda APENAS com o objeto JSON válido.
      `;

      const result = await generateWithJSON(prompt);
      
      return {
        diagnosis: result.diagnosis || '',
        treatment: result.treatment || '',
        prescription: result.prescription || '',
        hypotheses: result.hypotheses || [],
        recommendations: result.recommendations || ''
      };
    } catch (error) {
      console.error('Gemini medical record analysis error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to analyze symptoms for medical record'
      });
      throw error;
    }
  }

  async transcribeAndSummarizeConsultation(audioTranscript: string): Promise<{
    summary: string;
    keyPoints: string[];
    diagnosis?: string;
    treatment?: string;
    followUp?: string;
  }> {
    try {
      const prompt = `
        Analise esta transcrição de consulta médica e forneça um resumo estruturado:
        
        Transcrição: "${audioTranscript}"
        
        Forneça um resumo em JSON com:
        - summary: resumo geral da consulta
        - keyPoints: array com pontos-chave discutidos
        - diagnosis: diagnóstico mencionado (se houver)
        - treatment: tratamento prescrito (se houver)
        - followUp: orientações de acompanhamento (se houver)
      `;

      return await generateWithJSON(prompt);
    } catch (error) {
      console.error('Gemini transcription error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to process consultation transcription'
      });
      throw error;
    }
  }

  async answerClinicalQuestion(question: string, context?: string): Promise<string> {
    try {
      const prompt = `
        Pergunta: "${question}"
        ${context ? `Contexto adicional: ${context}` : ''}
        
        Forneça uma resposta clara, precisa e baseada em evidências científicas. Sempre cite as fontes quando possível e lembre o paciente de que esta resposta não substitui uma consulta médica presencial.
      `;

      const systemInstruction = "Você é um assistente médico especializado que responde dúvidas clínicas baseado nas diretrizes da OMS (Organização Mundial da Saúde), Protocolos de Atenção Primária do Ministério da Saúde do Brasil (Cadernos de Atenção Básica, PCDT/CONITEC, RENAME), e DSM-5/DSM-5-TR para condições psiquiátricas. Sempre seja preciso, cite as fontes das diretrizes utilizadas e seja responsável em suas respostas.";

      return await generateText(prompt, systemInstruction);
    } catch (error) {
      console.error('Gemini clinical question error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to process clinical question'
      });
      return `Desculpe, não foi possível processar sua pergunta médica no momento. Por favor, consulte diretamente com nossos profissionais de saúde.`;
    }
  }

  async extractExamResults(rawExamData: string, examType: string): Promise<{
    structuredResults: Record<string, any>;
    abnormalValues: Array<{ parameter: string; value: string; reference: string; status: 'high' | 'low' }>;
    summary: string;
  }> {
    try {
      const prompt = `
        Extraia e estruture os dados deste exame médico:
        
        Tipo de exame: ${examType}
        Dados brutos: "${rawExamData}"
        
        Forneça um JSON com:
        - structuredResults: objeto com todos os parâmetros e valores
        - abnormalValues: array com valores fora da normalidade
        - summary: resumo dos principais achados
      `;

      return await generateWithJSON(prompt);
    } catch (error) {
      console.error('Gemini exam extraction error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to extract exam results'
      });
      return {
        structuredResults: {},
        abnormalValues: [],
        summary: 'Erro ao processar resultados do exame',
      };
    }
  }

  async generateClinicalAnalysis(prompt: string): Promise<string> {
    try {
      const systemInstruction = "You are a medical AI assistant specialized in generating SOAP reports for Brazilian healthcare (SUS). Always respond in Portuguese and follow medical documentation standards. Base your clinical reasoning on WHO guidelines, Brazilian Ministry of Health protocols (Cadernos de Atenção Básica, PCDT/CONITEC), and DSM-5/DSM-5-TR criteria for psychiatric conditions.";
      
      return await generateText(prompt, systemInstruction);
    } catch (error) {
      console.error('Gemini clinical analysis error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to generate clinical analysis'
      });
      return 'Erro ao gerar análise clínica. Tente novamente.';
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    try {
      console.log('Transcription requested - buffer size:', audioBuffer.length, 'type:', mimeType);
      
      // Gemini doesn't have built-in audio transcription like Whisper
      // This would require a separate transcription service
      return 'Transcrição de áudio solicitada. Implementação de transcrição pendente.';
      
    } catch (error) {
      console.error('Gemini transcription error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: 'Failed to transcribe audio'
      });
      return 'Erro ao transcrever áudio. Verifique o formato do arquivo.';
    }
  }

  async generatePatientSummary(patientHistory: any[], consultationNotes: any[]): Promise<string> {
    try {
      const historyText = patientHistory.map(h => 
        `${h.date}: ${h.condition || h.diagnosis || h.description}`
      ).join('\n');
      
      const notesText = consultationNotes.map(n => 
        `[${n.type}] ${n.note}`
      ).join('\n');

      const prompt = `
Analise o histórico médico e as anotações da consulta atual para gerar um resumo do paciente:

HISTÓRICO MÉDICO:
${historyText}

ANOTAÇÕES DA CONSULTA ATUAL:
${notesText}

Gere um resumo estruturado em português brasileiro incluindo:
1. Condições médicas relevantes
2. Evolução do quadro clínico
3. Padrões identificados
4. Recomendações para acompanhamento

Formato: texto corrido, máximo 300 palavras.
`;

      const systemInstruction = "You are a medical AI assistant specialized in patient summary generation for Brazilian healthcare. Follow WHO guidelines, Brazilian Ministry of Health protocols (CAB, PCDT/CONITEC), and DSM-5/DSM-5-TR for psychiatric conditions.";
      
      return await generateText(prompt, systemInstruction);
    } catch (error) {
      console.error('Gemini patient summary error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to generate patient summary'
      });
      return 'Erro ao gerar resumo do paciente.';
    }
  }

  async analyzeExamResults(
    examType: string,
    results: any,
    patientHistory: string
  ): Promise<{
    analysis: string;
    abnormalValues?: Array<{ parameter: string; value: string; status: 'high' | 'low'; severity: 'mild' | 'moderate' | 'severe' }>;
    recommendations: string[];
    followUpRequired: boolean;
  }> {
    try {
      const resultsText = typeof results === 'object' ? JSON.stringify(results, null, 2) : results.toString();
      
      const prompt = `
        Como médico especialista em análise laboratorial, analise os resultados do exame e forneça uma interpretação clínica completa.
        
        Tipo de exame: ${examType}
        Resultados: ${resultsText}
        Histórico do paciente: ${patientHistory}
        
        Forneça uma análise em JSON com:
        - analysis: interpretação detalhada dos resultados
        - abnormalValues: array de valores alterados com parameter, value, status (high/low), severity (mild/moderate/severe)
        - recommendations: array de recomendações clínicas
        - followUpRequired: boolean indicando se requer acompanhamento
        
        Base sua análise nas diretrizes do Ministério da Saúde brasileiro e valores de referência padrão.
      `;

      return await generateWithJSON(prompt);
    } catch (error) {
      console.error('Gemini exam analysis error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to analyze exam results'
      });
      return {
        analysis: 'Não foi possível analisar os resultados do exame automaticamente.',
        recommendations: ['Consulte um médico para interpretação dos resultados'],
        followUpRequired: true
      };
    }
  }

  async analyzeDrugInteractions(medications: string[]): Promise<{
    hasInteractions: boolean;
    interactions: Array<{
      drug1: string;
      drug2: string;
      severity: 'mild' | 'moderate' | 'severe';
      description: string;
      recommendation: string;
    }>;
    summary: string;
  }> {
    try {
      const prompt = `
        Analise as possíveis interações medicamentosas entre os seguintes medicamentos:
        
        Medicamentos: ${medications.join(', ')}
        
        Forneça uma análise em JSON com:
        - hasInteractions: boolean indicando se há interações
        - interactions: array de objetos com:
          - drug1: primeiro medicamento
          - drug2: segundo medicamento
          - severity: gravidade (mild/moderate/severe)
          - description: descrição da interação
          - recommendation: recomendação clínica
        - summary: resumo geral das interações encontradas
        
        Base sua análise em guidelines médicos reconhecidos e literatura científica.
      `;

      return await generateWithJSON(prompt);
    } catch (error) {
      console.error('Gemini drug interaction analysis error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to analyze drug interactions'
      });
      return {
        hasInteractions: false,
        interactions: [],
        summary: 'Erro ao analisar interações medicamentosas. Consulte um farmacêutico.',
      };
    }
  }

  async chatWithContext(
    userMessage: string,
    systemContext: string,
    conversationHistory: Array<{ role: string; content: string }>,
    userRole: 'patient' | 'doctor' | 'visitor' | 'admin' | 'researcher' = 'patient'
  ): Promise<{ response: string; referencesUsed: string[] }> {
    try {
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ 
        model: "gemini-2.0-flash"
      });

      // Search for relevant PDF references from database with keyword matching
      let pdfReferences = '';
      let referencesUsed: string[] = [];
      try {
        // Extract potential keywords from user message
        const messageLower = userMessage.toLowerCase();
        const medicalKeywords = [
          'dor', 'febre', 'tosse', 'náusea', 'vômito', 'diarreia', 'cefaleia', 
          'pressão', 'diabetes', 'hipertensão', 'covid', 'gripe', 'resfriado',
          'sintoma', 'diagnóstico', 'tratamento', 'medicamento', 'exame',
          'harrison', 'medicina interna', 'emergência', 'cardiovascular', 
          'respiratório', 'gastrointestinal', 'neurológico', 'infecção',
          'depressão', 'ansiedade', 'pânico', 'bipolar', 'esquizofrenia', 'psiquiátrico',
          'saúde mental', 'suicídio', 'insônia', 'TOC', 'TDAH', 'autismo', 'fobia',
          'trauma', 'TEPT', 'estresse', 'álcool', 'tabaco', 'substância', 'drogas',
          'personalidade', 'borderline', 'anorexia', 'bulimia', 'alimentar',
          'antidepressivo', 'antipsicótico', 'estabilizador', 'benzodiazepínico',
          'OMS', 'DSM', 'protocolo', 'atenção primária', 'pré-natal', 'gestante',
          'criança', 'puericultura', 'vacina', 'imunização', 'tuberculose', 'HIV',
          'dengue', 'hepatite', 'sífilis', 'IST', 'câncer', 'rastreamento'
        ];

        // Get all active references for this role
        let references = await db.select()
          .from(chatbotReferences)
          .where(and(
            eq(chatbotReferences.isActive, true),
            sql`${userRole} = ANY(${chatbotReferences.allowedRoles})`
          ))
          .orderBy(sql`${chatbotReferences.priority} DESC`)
          .limit(10); // Get more candidates for filtering

        // Score and filter references based on keyword relevance
        const scoredReferences = references.map(ref => {
          let score = ref.priority || 1;
          
          // Boost score if reference matches keywords from user message
          if (ref.keywords && ref.keywords.length > 0) {
            const keywordMatches = ref.keywords.filter(kw => 
              messageLower.includes(kw.toLowerCase())
            ).length;
            score += keywordMatches * 10;
          }
          
          // Boost score if title or content contains relevant terms
          const titleLower = ref.title.toLowerCase();
          const contentLower = (ref.content || '').toLowerCase();
          
          medicalKeywords.forEach(keyword => {
            if (messageLower.includes(keyword)) {
              if (titleLower.includes(keyword)) score += 5;
              if (contentLower.includes(keyword)) score += 2;
            }
          });

          // Prioritize Harrison references for medical questions
          if ((titleLower.includes('harrison') || contentLower.includes('harrison')) &&
              (messageLower.includes('diagnóstico') || messageLower.includes('tratamento') || 
               messageLower.includes('sintoma') || messageLower.includes('doença'))) {
            score += 20;
          }

          // Prioritize OMS/WHO guidelines for clinical protocol questions
          if ((titleLower.includes('oms') || titleLower.includes('who') || titleLower.includes('organização mundial')) &&
              (messageLower.includes('protocolo') || messageLower.includes('diretriz') || messageLower.includes('guideline') ||
               messageLower.includes('tratamento') || messageLower.includes('diagnóstico') || messageLower.includes('triagem'))) {
            score += 15;
          }

          // Prioritize Brazilian Primary Care protocols
          if ((titleLower.includes('atenção primária') || titleLower.includes('ministério da saúde') || titleLower.includes('caderno')) &&
              (messageLower.includes('sus') || messageLower.includes('atenção básica') || messageLower.includes('protocolo') ||
               messageLower.includes('tratamento') || messageLower.includes('pré-natal') || messageLower.includes('vacinação') ||
               messageLower.includes('hipertensão') || messageLower.includes('diabetes'))) {
            score += 15;
          }

          // Prioritize DSM-5 for psychiatric/mental health questions
          if ((titleLower.includes('dsm') || titleLower.includes('psiquiátric') || titleLower.includes('transtornos mentais')) &&
              (messageLower.includes('depressão') || messageLower.includes('ansiedade') || messageLower.includes('bipolar') ||
               messageLower.includes('esquizofrenia') || messageLower.includes('pânico') || messageLower.includes('toc') ||
               messageLower.includes('tdah') || messageLower.includes('autismo') || messageLower.includes('personalidade') ||
               messageLower.includes('psiquiátric') || messageLower.includes('saúde mental') || messageLower.includes('suicíd') ||
               messageLower.includes('insônia') || messageLower.includes('álcool') || messageLower.includes('substância') ||
               messageLower.includes('antidepressivo') || messageLower.includes('antipsicótico'))) {
            score += 20;
          }
          
          return { ...ref, relevanceScore: score };
        });

        // Sort by relevance and take top 5
        const topReferences = scoredReferences
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 5);

        if (topReferences.length > 0) {
          pdfReferences = '\n\n═══════════════════════════════════════════\n';
          pdfReferences += '📚 REFERÊNCIAS MÉDICAS PRIORITÁRIAS\n';
          pdfReferences += '═══════════════════════════════════════════\n\n';
          pdfReferences += '⚠️ INSTRUÇÕES CRÍTICAS:\n';
          pdfReferences += '1. Use EXCLUSIVAMENTE as informações destas referências para responder\n';
          pdfReferences += '2. Cite o nome da referência ao mencionar informações dela\n';
          pdfReferences += '3. Se a resposta não estiver nas referências, seja honesto e diga que não possui a informação\n';
          pdfReferences += '4. Priorize evidências científicas das referências sobre conhecimento geral\n\n';
          
          topReferences.forEach((ref, index) => {
            if (ref.pdfExtractedText || ref.content) {
              pdfReferences += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
              pdfReferences += `📖 REFERÊNCIA ${index + 1}: ${ref.title}\n`;
              pdfReferences += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
              pdfReferences += `📂 Categoria: ${ref.category}\n`;
              if (ref.source) {
                pdfReferences += `🔗 Fonte: ${ref.source}\n`;
              }
              if (ref.keywords && ref.keywords.length > 0) {
                pdfReferences += `🏷️  Palavras-chave: ${ref.keywords.join(', ')}\n`;
              }
              pdfReferences += `📊 Relevância: ${ref.relevanceScore}/100\n\n`;
              
              // Truncate very long content to avoid token limits
              const content = ref.pdfExtractedText || ref.content;
              const maxLength = 3000; // characters per reference
              const truncatedContent = content.length > maxLength 
                ? content.substring(0, maxLength) + '\n\n[...conteúdo truncado...]' 
                : content;
              
              pdfReferences += `📄 CONTEÚDO:\n${truncatedContent}\n\n`;
              referencesUsed.push(ref.id);
            }
          });
          
          pdfReferences += '═══════════════════════════════════════════\n';
          pdfReferences += '📚 FIM DAS REFERÊNCIAS MÉDICAS\n';
          pdfReferences += '═══════════════════════════════════════════\n\n';
        }
      } catch (dbError) {
        console.error('Error fetching PDF references:', dbError);
        // Continue without references if there's an error
      }

      // Build conversation history for context
      let fullPrompt = systemContext + '\n\n';
      
      // Add PDF references FIRST (highest priority)
      if (pdfReferences) {
        fullPrompt += pdfReferences;
      }
      
      // Add last 5 messages for context (to keep token count reasonable)
      const recentHistory = conversationHistory.slice(-5);
      if (recentHistory.length > 0) {
        fullPrompt += '══════════════════════════════════════\n';
        fullPrompt += '💬 HISTÓRICO DA CONVERSA\n';
        fullPrompt += '══════════════════════════════════════\n\n';
        recentHistory.forEach((msg) => {
          const role = msg.role === 'user' ? '👤 Usuário' : '🤖 Assistente';
          fullPrompt += `${role}: ${msg.content}\n\n`;
        });
        fullPrompt += '══════════════════════════════════════\n\n';
      }
      
      fullPrompt += `═══ 💬 NOVA PERGUNTA ═══\n${userMessage}\n\n═══ 🤖 SUA RESPOSTA ═══\n`;

      let responseText: string;
      try {
        const result = await model.generateContent(fullPrompt);
        responseText = result.response.text();
      } catch (geminiError) {
        if (isGeminiUnavailable(geminiError)) {
          console.log('Gemini unavailable in chatWithContext, falling back to OpenAI');
          responseText = await generateTextOpenAI(fullPrompt);
        } else {
          throw geminiError;
        }
      }
      
      // Update usage count for used references
      if (referencesUsed.length > 0) {
        try {
          await Promise.all(referencesUsed.map(refId =>
            db.update(chatbotReferences)
              .set({
                lastUsed: new Date(),
                usageCount: sql`${chatbotReferences.usageCount} + 1`
              })
              .where(eq(chatbotReferences.id, refId))
          ));
        } catch (updateError) {
          console.error('Error updating reference usage:', updateError);
        }
      }
      
      return {
        response: responseText,
        referencesUsed
      };
    } catch (error) {
      console.error('Gemini chat error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Failed to generate chat response'
      });
      
      if (error instanceof Error && error.message.includes('GEMINI_API_KEY')) {
        return {
          response: 'Funcionalidade de IA temporariamente indisponível. Configure a GEMINI_API_KEY para usar este assistente.',
          referencesUsed: []
        };
      }
      
      return {
        response: 'Desculpe, houve um erro ao processar sua pergunta. Por favor, tente novamente.',
        referencesUsed: []
      };
    }
  }
  async analyzeECGImage(imageBase64: string, patientContext: {
    age?: number;
    sex?: string;
    clinicalHistory?: string;
  }, onProgress?: (pass: number, total: number) => void): Promise<any> {
    const patientInfo = [
      patientContext.age ? `IDADE: ${patientContext.age} anos` : '',
      patientContext.sex ? `SEXO: ${patientContext.sex}` : '',
      patientContext.clinicalHistory ? `HISTÓRIA CLÍNICA: ${patientContext.clinicalHistory}` : '',
    ].filter(Boolean).join(' | ');

    const ecgConfig = await getECGConfig();
    const ecgJsonSchema = ecgConfig.jsonSchemaTemplate;

    const pass1Prompt = buildECGPrompt(ecgConfig.analysisPrompts.pass1_ecgReader, patientInfo, ecgConfig);

    const pass2Prompt = buildECGPrompt(ecgConfig.analysisPrompts.pass2_ekgAnalyst, patientInfo, ecgConfig);

    const pass3Prompt = buildECGPrompt(ecgConfig.analysisPrompts.pass3_cardiologistSenior, patientInfo, ecgConfig);

    const SEVERITY_LABELS: Record<number, string> = {
      1: 'Baixo', 2: 'Moderado', 3: 'Alto', 4: 'Muito Alto', 5: 'Crítico',
    };

    const isPlaceholder = (val: any): boolean => {
      if (typeof val !== 'string') return false;
      const v = val.trim().toLowerCase();
      return v === 'string' || v === 'xx%' || v === '#hex' || v === 'ex:' || v === '' || /^string\b/.test(v);
    };

    const sanitizeStr = (val: any, fallback: string): string => {
      if (!val || isPlaceholder(val)) return fallback;
      return String(val).replace(/^ex:\s*/i, '');
    };

    const sanitizeConfidence = (val: any): string => {
      if (!val || isPlaceholder(val)) return '0%';
      const s = String(val);
      if (/\d+%/.test(s)) return s;
      const num = parseFloat(s);
      if (!isNaN(num)) return `${Math.round(num)}%`;
      return '0%';
    };

    const normalizeECGResult = (raw: any) => {
      const normalizeSysItem = (item: any) => ({
        finding: sanitizeStr(item?.finding, 'Não avaliado'),
        normal_range: item?.normal_range ?? '',
        is_normal: item?.is_normal ?? true,
        clinical_significance: sanitizeStr(item?.clinical_significance, ''),
        percentage_descriptor: sanitizeStr(item?.percentage_descriptor, ''),
      });
      return {
        ecg_metrics: {
          heart_rate: sanitizeStr(raw?.ecg_metrics?.heart_rate, 'Não determinado'),
          rhythm: sanitizeStr(raw?.ecg_metrics?.rhythm, 'Não determinado'),
          qrs_width: sanitizeStr(raw?.ecg_metrics?.qrs_width, 'Não determinado'),
          atrial_activity: sanitizeStr(raw?.ecg_metrics?.atrial_activity, 'Não determinado'),
          signal_quality: sanitizeStr(raw?.ecg_metrics?.signal_quality, 'Não determinado'),
        },
        lead_by_lead_analysis: raw?.lead_by_lead_analysis ?? {},
        waveform_segmentation: {
          p_wave: sanitizeStr(raw?.waveform_segmentation?.p_wave, 'Não avaliado'),
          pr_interval: sanitizeStr(raw?.waveform_segmentation?.pr_interval, 'Não avaliado'),
          qrs_complex: sanitizeStr(raw?.waveform_segmentation?.qrs_complex, 'Não avaliado'),
          st_segment: sanitizeStr(raw?.waveform_segmentation?.st_segment, 'Não avaliado'),
          t_wave: sanitizeStr(raw?.waveform_segmentation?.t_wave, 'Não avaliado'),
          qt_interval: sanitizeStr(raw?.waveform_segmentation?.qt_interval, 'Não avaliado'),
          u_wave: sanitizeStr(raw?.waveform_segmentation?.u_wave, 'Não avaliado'),
        },
        rhythm_strip_interpretation: sanitizeStr(raw?.rhythm_strip_interpretation, 'Interpretação da faixa de ritmo não disponível.'),
        cardiac_interpretation: sanitizeStr(raw?.cardiac_interpretation, 'Interpretação cardíaca não disponível.'),
        key_findings: Array.isArray(raw?.key_findings)
          ? raw.key_findings.filter((f: any) => f && !isPlaceholder(f)).map((f: any) => String(f).replace(/^ex:\s*/i, ''))
          : [],
        systematic_analysis: {
          ritmo: normalizeSysItem(raw?.systematic_analysis?.ritmo),
          frequencia_cardiaca: normalizeSysItem(raw?.systematic_analysis?.frequencia_cardiaca),
          eixo_qrs: normalizeSysItem(raw?.systematic_analysis?.eixo_qrs),
          onda_p: normalizeSysItem(raw?.systematic_analysis?.onda_p),
          intervalo_pr: normalizeSysItem(raw?.systematic_analysis?.intervalo_pr),
          complexo_qrs: normalizeSysItem(raw?.systematic_analysis?.complexo_qrs),
          segmento_st: normalizeSysItem(raw?.systematic_analysis?.segmento_st),
          onda_t: normalizeSysItem(raw?.systematic_analysis?.onda_t),
          intervalo_qt: normalizeSysItem(raw?.systematic_analysis?.intervalo_qt),
        },
        epidemiological_data: Array.isArray(raw?.epidemiological_data)
          ? raw.epidemiological_data
              .filter((e: any) => e?.finding && !isPlaceholder(e.finding))
              .map((e: any) => ({
                finding: sanitizeStr(e?.finding, ''),
                prevalence: sanitizeStr(e?.prevalence, ''),
                source: e?.source ?? '',
              }))
          : [],
        color_coded_annotations: Array.isArray(raw?.color_coded_annotations)
          ? raw.color_coded_annotations
              .filter((a: any) => a?.region && !isPlaceholder(a.region))
              .map((a: any) => ({
                region: sanitizeStr(a?.region, ''),
                color_hex: isPlaceholder(a?.color_hex) ? '#6B7280' : (a?.color_hex ?? '#6B7280'),
                color_name: sanitizeStr(a?.color_name, ''),
                hypothesis: sanitizeStr(a?.hypothesis, ''),
                probability: sanitizeConfidence(a?.probability),
                description: sanitizeStr(a?.description, ''),
              }))
          : [],
        presumptive_diagnosis: {
          name: sanitizeStr(raw?.presumptive_diagnosis?.name, 'Não determinado'),
          confidence: sanitizeConfidence(raw?.presumptive_diagnosis?.confidence),
          color: isPlaceholder(raw?.presumptive_diagnosis?.color) ? '#3B82F6' : (raw?.presumptive_diagnosis?.color ?? '#3B82F6'),
          reasoning: sanitizeStr(raw?.presumptive_diagnosis?.reasoning, ''),
        },
        differential_diagnoses: Array.isArray(raw?.differential_diagnoses)
          ? raw.differential_diagnoses
              .filter((d: any) => d?.name && !isPlaceholder(d.name))
              .map((d: any) => ({
                name: sanitizeStr(d?.name, 'Diagnóstico alternativo'),
                confidence: sanitizeConfidence(d?.confidence),
                color: isPlaceholder(d?.color) ? '#6B7280' : (d?.color ?? '#6B7280'),
                reasoning: sanitizeStr(d?.reasoning, ''),
                key_indicators: Array.isArray(d?.key_indicators)
                  ? d.key_indicators.filter((k: any) => !isPlaceholder(k))
                  : [],
              }))
          : [],
        action_plan: {
          immediate_actions: Array.isArray(raw?.action_plan?.immediate_actions)
            ? raw.action_plan.immediate_actions.filter((a: any) => !isPlaceholder(a))
            : [],
          follow_up: Array.isArray(raw?.action_plan?.follow_up)
            ? raw.action_plan.follow_up.filter((a: any) => !isPlaceholder(a))
            : [],
          monitoring: Array.isArray(raw?.action_plan?.monitoring)
            ? raw.action_plan.monitoring.filter((a: any) => !isPlaceholder(a))
            : [],
        },
        clinical_comment: sanitizeStr(raw?.clinical_comment, ''),
        recommended_conduct: sanitizeStr(raw?.recommended_conduct, 'Conduta recomendada não disponível.'),
        severity_level: (() => {
          const rawLevel = raw?.severity_level?.level;
          const level = typeof rawLevel === 'number' ? Math.min(5, Math.max(1, Math.round(rawLevel))) :
            typeof rawLevel === 'string' ? (parseInt(rawLevel, 10) || 1) : 1;
          const rawLabel = raw?.severity_level?.label;
          const label = (rawLabel && !isPlaceholder(rawLabel)) ? rawLabel : SEVERITY_LABELS[level] || 'Não classificado';
          return {
            level,
            label,
            description: sanitizeStr(raw?.severity_level?.description, ''),
          };
        })(),
        technical_report: sanitizeStr(raw?.technical_report, 'Laudo técnico não disponível.'),
        diagnosis_probabilities: raw?.diagnosis_probabilities ?? {},
        visual_annotation_instructions: raw?.visual_annotation_instructions ?? {},
        technical_summary: sanitizeStr(raw?.technical_summary, 'Análise técnica não disponível.'),
        simple_summary: sanitizeStr(raw?.simple_summary, 'Resumo simplificado não disponível.'),
        disclaimer: sanitizeStr(raw?.disclaimer, 'Análise automatizada por IA. Requer revisão e validação médica profissional. Não substitui avaliação clínica presencial.'),
      };
    };

    const runSinglePass = async (prompt: string): Promise<any> => {
      let geminiError: unknown = null;
      try {
        const client = getGeminiClient();
        const model = client.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 8000,
          },
        });
        const response = await model.generateContent([
          prompt,
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        ]);
        return JSON.parse(response.response.text());
      } catch (err) {
        geminiError = err;
        console.error('Gemini ECG pass error:', err instanceof Error ? err.message : err);
      }

      try {
        const openai = getOpenAIFallback();
        const response = await openai.chat.completions.create({
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: [
              { type: 'text', text: `Analise esta imagem de ECG. Dados: ${patientInfo || 'Não informado'}. Retorne JSON conforme schema.` },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}`, detail: 'high' } },
            ]},
          ],
          response_format: { type: 'json_object' },
          max_tokens: 8000,
          temperature: 0.2,
        });
        return JSON.parse(response.choices[0].message.content || '{}');
      } catch (openaiError) {
        console.error('OpenAI fallback also failed:', openaiError instanceof Error ? openaiError.message : openaiError);
        throw geminiError || openaiError;
      }
    };

    const passes = [pass1Prompt, pass2Prompt, pass3Prompt];
    const passResults: any[] = [];

    for (let i = 0; i < passes.length; i++) {
      console.log(`ECG Triple-Verification: starting pass ${i + 1}/3`);
      try {
        const raw = await runSinglePass(passes[i]);
        passResults.push(normalizeECGResult(raw));
      } catch (err) {
        console.error(`ECG pass ${i + 1} failed:`, err instanceof Error ? err.message : err);
        passResults.push(null);
      }
      if (onProgress) onProgress(i + 1, 3);
    }

    const validResults = passResults.filter(Boolean);
    if (validResults.length === 0) {
      throw new Error('All three ECG analysis passes failed');
    }

    const consensus = this.crossValidateECGResults(validResults, normalizeECGResult);
    consensus.triple_verification = {
      passes_completed: validResults.length,
      passes_total: 3,
      methodology: ['ECG Reader (7-Phase Pipeline)', 'EKG Analyst (Systematic Cardiac Assessment)', 'Cardiology Senior Validation Filter'],
      cross_validated: true,
    };
    return consensus;
  }

  private crossValidateECGResults(results: any[], normalizeECGResult: (raw: any) => any): any {
    if (results.length === 1) return results[0];

    const base = { ...results[0] };

    const sysKeys = ['ritmo', 'frequencia_cardiaca', 'eixo_qrs', 'onda_p', 'intervalo_pr', 'complexo_qrs', 'segmento_st', 'onda_t', 'intervalo_qt'] as const;
    for (const key of sysKeys) {
      const items = results.map(r => r.systematic_analysis?.[key]).filter(Boolean);
      const hasAbnormal = items.some(item => item.is_normal === false);
      if (hasAbnormal && base.systematic_analysis?.[key]?.is_normal === true) {
        const abnormalItem = items.find(item => item.is_normal === false);
        if (abnormalItem) {
          base.systematic_analysis[key] = {
            ...abnormalItem,
            clinical_significance: `[Validação cruzada] ${abnormalItem.clinical_significance}`,
          };
        }
      }
    }

    const allFindings = new Map<string, string>();
    for (const r of results) {
      if (Array.isArray(r.key_findings)) {
        for (const f of r.key_findings) {
          const normalized = f.toLowerCase().replace(/\d+%/g, '').trim();
          if (!allFindings.has(normalized) || f.length > (allFindings.get(normalized)?.length || 0)) {
            allFindings.set(normalized, f);
          }
        }
      }
    }
    base.key_findings = Array.from(allFindings.values()).slice(0, 10);

    const allDiags = new Map<string, any>();
    for (const r of results) {
      if (Array.isArray(r.differential_diagnoses)) {
        for (const d of r.differential_diagnoses) {
          const key = d.name?.toLowerCase().trim();
          if (!key) continue;
          const existing = allDiags.get(key);
          if (!existing || parseFloat(d.confidence) > parseFloat(existing.confidence)) {
            allDiags.set(key, d);
          }
        }
      }
    }
    base.differential_diagnoses = Array.from(allDiags.values()).slice(0, 8);

    const allAnnotations = new Map<string, any>();
    for (const r of results) {
      if (Array.isArray(r.color_coded_annotations)) {
        for (const a of r.color_coded_annotations) {
          const key = `${a.region}-${a.hypothesis}`.toLowerCase();
          if (!allAnnotations.has(key)) allAnnotations.set(key, a);
        }
      }
    }
    base.color_coded_annotations = Array.from(allAnnotations.values()).slice(0, 10);

    const severities = results.map(r => r.severity_level?.level ?? 1);
    const maxSeverity = Math.max(...severities);
    if (maxSeverity > (base.severity_level?.level ?? 1)) {
      const highestResult = results.find(r => r.severity_level?.level === maxSeverity);
      if (highestResult?.severity_level) {
        base.severity_level = highestResult.severity_level;
      }
    }

    const diagCandidates = results.map(r => r.presumptive_diagnosis).filter(Boolean);
    if (diagCandidates.length > 1) {
      const nonNormal = diagCandidates.filter(d =>
        !d.name?.toLowerCase().includes('normal') && !d.name?.toLowerCase().includes('sem alterações')
      );
      if (nonNormal.length > 0) {
        const best = nonNormal.reduce((a: any, b: any) =>
          parseFloat(a.confidence) >= parseFloat(b.confidence) ? a : b
        );
        base.presumptive_diagnosis = best;
      }
    }

    const allEpi = new Map<string, any>();
    for (const r of results) {
      if (Array.isArray(r.epidemiological_data)) {
        for (const e of r.epidemiological_data) {
          if (e.finding && !allEpi.has(e.finding.toLowerCase())) {
            allEpi.set(e.finding.toLowerCase(), e);
          }
        }
      }
    }
    base.epidemiological_data = Array.from(allEpi.values()).slice(0, 8);

    for (const r of results) {
      if (r.action_plan) {
        const mergeArray = (key: string) => {
          const existing = new Set((base.action_plan?.[key] || []).map((s: string) => s.toLowerCase()));
          for (const item of (r.action_plan[key] || [])) {
            if (!existing.has(item.toLowerCase())) {
              base.action_plan[key] = [...(base.action_plan[key] || []), item];
              existing.add(item.toLowerCase());
            }
          }
        };
        mergeArray('immediate_actions');
        mergeArray('follow_up');
        mergeArray('monitoring');
      }
    }

    if (results.length > 1 && results[results.length - 1]?.cardiac_interpretation) {
      base.cardiac_interpretation = results[results.length - 1].cardiac_interpretation;
    }
    if (results.length > 1 && results[results.length - 1]?.technical_report) {
      base.technical_report = results[results.length - 1].technical_report;
    }

    const allProbs: Record<string, number> = {};
    for (const r of results) {
      if (r.diagnosis_probabilities) {
        for (const [name, pct] of Object.entries(r.diagnosis_probabilities)) {
          const val = parseFloat(String(pct));
          if (!isNaN(val)) {
            const key = name.toLowerCase();
            allProbs[key] = Math.max(allProbs[key] || 0, val);
          }
        }
      }
    }
    base.diagnosis_probabilities = Object.fromEntries(
      Object.entries(allProbs).map(([k, v]) => [k, `${v}%`])
    );

    base.disclaimer = 'Análise automatizada por IA com tripla verificação cruzada (ECG Reader + EKG Analyst + Validação Cardiológica). Requer revisão e validação médica profissional. Não substitui avaliação clínica presencial.';

    return base;
  }

  async analyzeRadiologyImage(imageBase64: string, patientContext: {
    age?: number;
    sex?: string;
    clinicalHistory?: string;
    anatomicalRegion?: string;
  }): Promise<any> {
    const patientInfo = [
      patientContext.age ? `IDADE: ${patientContext.age} anos` : '',
      patientContext.sex ? `SEXO: ${patientContext.sex}` : '',
      patientContext.clinicalHistory ? `HISTÓRIA CLÍNICA: ${patientContext.clinicalHistory}` : '',
      patientContext.anatomicalRegion ? `REGIÃO ANATÔMICA: ${patientContext.anatomicalRegion}` : '',
    ].filter(Boolean).join(' | ');

    const radConfig = await getRadiologyConfig();
    const prompt = buildRadiologyPrompt(radConfig.analysisPrompt, patientInfo, radConfig);

    const normalizeRadiologyResult = (raw: any) => ({
      radiology_findings: {
        dominant_pathology: raw?.radiology_findings?.dominant_pathology ?? 'Não identificado',
        anatomical_region: raw?.radiology_findings?.anatomical_region ?? 'Não determinada',
        clinical_impact_percentage: raw?.radiology_findings?.clinical_impact_percentage ?? '0%',
        laterality: raw?.radiology_findings?.laterality ?? 'N/A',
        description: raw?.radiology_findings?.description ?? '',
      },
      anatomical_overlay: Array.isArray(raw?.anatomical_overlay)
        ? raw.anatomical_overlay.map((s: any) => ({
            structure: s?.structure ?? '',
            relevance_percentage: s?.relevance_percentage ?? '0%',
            comment: s?.comment ?? '',
            status: s?.status ?? 'normal',
          }))
        : [],
      normal_comparison: {
        description: raw?.normal_comparison?.description ?? '',
        key_differences: Array.isArray(raw?.normal_comparison?.key_differences) ? raw.normal_comparison.key_differences : [],
      },
      pathophysiology_model: raw?.pathophysiology_model ?? '',
      probabilistic_diagnosis: {
        presumptive: {
          name: raw?.probabilistic_diagnosis?.presumptive?.name ?? 'Não determinado',
          confidence: raw?.probabilistic_diagnosis?.presumptive?.confidence ?? '0%',
          color: raw?.probabilistic_diagnosis?.presumptive?.color ?? '#3B82F6',
          reasoning: raw?.probabilistic_diagnosis?.presumptive?.reasoning ?? '',
        },
        differentials: Array.isArray(raw?.probabilistic_diagnosis?.differentials)
          ? raw.probabilistic_diagnosis.differentials.map((d: any) => ({
              name: d?.name ?? '',
              confidence: d?.confidence ?? '0%',
              color: d?.color ?? '#6B7280',
              reasoning: d?.reasoning ?? '',
              key_indicators: Array.isArray(d?.key_indicators) ? d.key_indicators : [],
            }))
          : [],
      },
      prognostic_estimation: {
        severity_score: raw?.prognostic_estimation?.severity_score ?? '',
        functional_progression_risk: raw?.prognostic_estimation?.functional_progression_risk ?? '0%',
        intervention_risk: raw?.prognostic_estimation?.intervention_risk ?? '0%',
        prognosis_model: raw?.prognostic_estimation?.prognosis_model ?? '',
      },
      formal_report: {
        exam: raw?.formal_report?.exam ?? '',
        technique: raw?.formal_report?.technique ?? '',
        findings: raw?.formal_report?.findings ?? '',
        diagnostic_impression: raw?.formal_report?.diagnostic_impression ?? '',
        recommendations: raw?.formal_report?.recommendations ?? '',
      },
      lay_summary: Array.isArray(raw?.lay_summary) ? raw.lay_summary : [],
      educational_note: {
        quality_score: raw?.educational_note?.quality_score ?? 3,
        quality_assessment: raw?.educational_note?.quality_assessment ?? '',
        didactic_note: raw?.educational_note?.didactic_note ?? '',
        next_steps: raw?.educational_note?.next_steps ?? '',
      },
      severity_level: {
        level: raw?.severity_level?.level ?? 1,
        label: raw?.severity_level?.label ?? 'Não classificado',
        description: raw?.severity_level?.description ?? '',
      },
      recommended_conduct: raw?.recommended_conduct ?? 'Conduta não disponível.',
      multi_specialty_relevance: Array.isArray(raw?.multi_specialty_relevance)
        ? raw.multi_specialty_relevance.map((s: any) => ({
            specialty: s?.specialty ?? '',
            relevance: s?.relevance ?? '',
            urgency: s?.urgency ?? 'baixa',
          }))
        : [],
      technical_quality: {
        projection: raw?.technical_quality?.projection ?? '',
        rotation: raw?.technical_quality?.rotation ?? '',
        centering: raw?.technical_quality?.centering ?? '',
        penetration: raw?.technical_quality?.penetration ?? '',
        collimation: raw?.technical_quality?.collimation ?? '',
        artifacts: raw?.technical_quality?.artifacts ?? 'Nenhum identificado',
        score: raw?.technical_quality?.score ?? 3,
      },
      color_coded_regions: Array.isArray(raw?.color_coded_regions)
        ? raw.color_coded_regions.map((r: any) => ({
            region: r?.region ?? '',
            color_hex: r?.color_hex ?? '#6B7280',
            color_name: r?.color_name ?? '',
            finding: r?.finding ?? '',
            risk_level: r?.risk_level ?? 'baixo',
          }))
        : [],
      clinical_comment: raw?.clinical_comment ?? '',
      action_plan: {
        immediate_actions: Array.isArray(raw?.action_plan?.immediate_actions) ? raw.action_plan.immediate_actions : [],
        follow_up: Array.isArray(raw?.action_plan?.follow_up) ? raw.action_plan.follow_up : [],
        monitoring: Array.isArray(raw?.action_plan?.monitoring) ? raw.action_plan.monitoring : [],
      },
      disclaimer: raw?.disclaimer ?? 'Análise automatizada por IA. Requer revisão e validação médica profissional. Não substitui avaliação clínica presencial.',
    });

    let geminiError: unknown = null;
    try {
      const client = getGeminiClient();
      const model = client.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 6000,
        },
      });

      const response = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
      ]);

      const text = response.response.text();
      const parsed = JSON.parse(text);
      return normalizeRadiologyResult(parsed);
    } catch (err) {
      geminiError = err;
      console.error('Gemini radiology analysis error:', err instanceof Error ? err.message : err);
    }

    console.log('Falling back to OpenAI for radiology analysis...');
    try {
      const openai = getOpenAIFallback();
      const response = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta imagem radiográfica. Dados do paciente: ${patientInfo || 'Não informado'}. Retorne JSON estruturado conforme o schema solicitado.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 6000,
        temperature: 0.2,
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return normalizeRadiologyResult(parsed);
    } catch (openaiError) {
      console.error('OpenAI fallback radiology analysis also failed:', openaiError instanceof Error ? openaiError.message : openaiError);
      throw geminiError || openaiError;
    }
  }
  private static readonly LANGUAGE_MAP: Record<string, string> = {
    pt: 'Portuguese (Brazil)',
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    it: 'Italian',
    de: 'German',
    zh: 'Chinese (Simplified)',
    gn: 'Guaraní',
  };

  async generateRadiologyPACSImage(analysisData: any, language?: string): Promise<string | null> {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { generateImageBuffer } = await import('../replit_integrations/image/client');
        const imagePrompt = await this.generateRadiologyPACSImagePrompt(analysisData, language);
        const imageBuffer = await generateImageBuffer(imagePrompt, '1024x1024');
        if (!imageBuffer || imageBuffer.length === 0) {
          throw new Error('Empty image buffer returned');
        }
        console.log(`Radiology immersive PACS image generated (attempt ${attempt})`);
        return imageBuffer.toString('base64');
      } catch (error) {
        console.error(`generateRadiologyPACSImage attempt ${attempt} error:`, error instanceof Error ? error.message : error);
        if (attempt === maxAttempts) {
          return null;
        }
        console.log('Retrying radiology image generation...');
      }
    }
    return null;
  }

  async generateRadiologyPACSImagePrompt(analysisData: any, language?: string): Promise<string> {
    const baseLang = (language || 'pt').split('-')[0].toLowerCase();
    const langName = GeminiService.LANGUAGE_MAP[baseLang] || 'Portuguese (Brazil)';
    const findings = analysisData.radiology_findings || {};
    const diagnosis = analysisData.probabilistic_diagnosis?.presumptive?.name || 'Radiological Study';
    const severity = analysisData.severity_level?.label || 'Moderate';
    const severityLevel = analysisData.severity_level?.level || 3;
    const region = findings.anatomical_region || 'Unspecified region';
    const laterality = findings.laterality || 'N/A';
    const dominantPathology = findings.dominant_pathology || 'Finding not identified';
    const impactPct = findings.clinical_impact_percentage || '0%';
    const description = findings.description || '';
    const formalReport = analysisData.formal_report || {};
    const laySummary = (analysisData.lay_summary || []).slice(0, 3).join(' | ');
    const colorRegions = (analysisData.color_coded_regions || []).slice(0, 8).map((r: any) =>
      `"${r.region}": ${r.finding} (${r.color_name} ${r.color_hex}, risk: ${r.risk_level})`
    ).join('. ');
    const differentials = (analysisData.probabilistic_diagnosis?.differentials || []).slice(0, 5).map((d: any) =>
      `${d.name}: ${d.confidence}`
    ).join(', ');
    const presumptive = analysisData.probabilistic_diagnosis?.presumptive || {};
    const prognostic = analysisData.prognostic_estimation || {};
    const techQuality = analysisData.technical_quality || {};
    const anatomicalOverlay = (analysisData.anatomical_overlay || []).slice(0, 10).map((a: any) =>
      `${a.structure}: ${a.relevance_percentage} (${a.status})`
    ).join(', ');
    const actionPlan = analysisData.action_plan || {};
    const educationalNote = analysisData.educational_note || {};
    const multiSpecialty = (analysisData.multi_specialty_relevance || []).slice(0, 4).map((s: any) =>
      `${s.specialty}: ${s.relevance} (${s.urgency})`
    ).join(', ');
    const recommendedConduct = analysisData.recommended_conduct || '';

    const radConfig = await getRadiologyConfig();
    const template = radConfig.imageGenerationPrompt;

    return template
      .replace(/\{\{langName\}\}/g, langName)
      .replace(/\{\{region\}\}/g, region)
      .replace(/\{\{dominantPathology\}\}/g, dominantPathology)
      .replace(/\{\{severityLevel\}\}/g, String(severityLevel))
      .replace(/\{\{severity\}\}/g, severity)
      .replace(/\{\{laterality\}\}/g, laterality)
      .replace(/\{\{impactPct\}\}/g, impactPct)
      .replace(/\{\{description\}\}/g, description)
      .replace(/\{\{anatomicalOverlay\}\}/g, anatomicalOverlay)
      .replace(/\{\{prognosticSeverity\}\}/g, prognostic.severity_score || severity)
      .replace(/\{\{functionalRisk\}\}/g, prognostic.functional_progression_risk || 'N/A')
      .replace(/\{\{interventionRisk\}\}/g, prognostic.intervention_risk || 'N/A')
      .replace(/\{\{prognosisModel\}\}/g, prognostic.prognosis_model || 'N/A')
      .replace(/\{\{presumptiveDiag\}\}/g, presumptive.name || 'N/A')
      .replace(/\{\{presumptiveConf\}\}/g, presumptive.confidence || 'N/A')
      .replace(/\{\{presumptiveColor\}\}/g, presumptive.color || 'red')
      .replace(/\{\{differentials\}\}/g, differentials)
      .replace(/\{\{formalExam\}\}/g, formalReport.exam || region)
      .replace(/\{\{formalTechnique\}\}/g, formalReport.technique || 'Adequate')
      .replace(/\{\{formalFindings\}\}/g, formalReport.findings || description)
      .replace(/\{\{formalImpression\}\}/g, formalReport.diagnostic_impression || diagnosis)
      .replace(/\{\{formalRecommendations\}\}/g, formalReport.recommendations || recommendedConduct)
      .replace(/\{\{laySummary\}\}/g, laySummary)
      .replace(/\{\{techScore\}\}/g, String(techQuality.score || 3))
      .replace(/\{\{techProjection\}\}/g, techQuality.projection || 'N/A')
      .replace(/\{\{techPenetration\}\}/g, techQuality.penetration || 'N/A')
      .replace(/\{\{educationalNote\}\}/g, educationalNote.didactic_note || 'N/A')
      .replace(/\{\{multiSpecialty\}\}/g, multiSpecialty)
      .replace(/\{\{immediateActions\}\}/g, (actionPlan.immediate_actions || []).slice(0, 2).join('; '))
      .replace(/\{\{followUp\}\}/g, (actionPlan.follow_up || []).slice(0, 2).join('; '))
      .replace(/\{\{colorRegions\}\}/g, colorRegions);
  }
}

export const geminiService = new GeminiService();
