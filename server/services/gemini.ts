import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { db } from "../db";
import { chatbotReferences } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

let genAI: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

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
    model: "gpt-4o-mini",
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
    model: "gpt-4o-mini",
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
}

export const geminiService = new GeminiService();
