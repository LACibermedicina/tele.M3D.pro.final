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
  async analyzeECGImage(imageBase64: string, patientContext: {
    age?: number;
    sex?: string;
    clinicalHistory?: string;
  }): Promise<any> {
    const patientInfo = [
      patientContext.age ? `IDADE: ${patientContext.age} anos` : '',
      patientContext.sex ? `SEXO: ${patientContext.sex}` : '',
      patientContext.clinicalHistory ? `HISTÓRIA CLÍNICA: ${patientContext.clinicalHistory}` : '',
    ].filter(Boolean).join(' | ');

    const prompt = `Você é o ECG Reader — um sistema de interpretação eletrocardiográfica de nível hospitalar que replica a metodologia clínica estruturada do "ECG Reader" GPT. Analise a imagem de ECG fornecida com contexto do paciente [${patientInfo}].

=== PIPELINE DE ANÁLISE ECG READER (7 FASES) ===

FASE 1 — VERIFICAÇÃO TÉCNICA E CALIBRAÇÃO:
- Confirmar velocidade do papel (padrão: 25 mm/s; se 50 mm/s, ajustar leituras)
- Verificar calibração de voltagem (padrão: 10 mm/mV = 1 mV)
- Avaliar qualidade do traçado: artefatos, interferência de linha de base, tremor muscular
- Identificar se ECG é de 12 derivações padrão ou formato reduzido

FASE 2 — ANÁLISE DERIVAÇÃO POR DERIVAÇÃO (Lead-by-Lead):
Para cada derivação (DI, DII, DIII, aVR, aVL, aVF, V1-V6), avaliar:
- Morfologia da onda P (presença, amplitude, duração, bifidez, inversão)
- Intervalo PR (onset da P até onset do QRS)
- Complexo QRS (duração, amplitude, morfologia — ondas Q, R, S, padrão rSR', QS)
- Ponto J e Segmento ST (elevação/depressão em mm, morfologia côncava/convexa/retificada)
- Onda T (orientação, amplitude, simetria, achatamento, inversão)
- Onda U (presença e significância)

FASE 3 — SEGMENTAÇÃO DE FORMAS DE ONDA:
- Separar e classificar cada componente: P-QRS-ST-T-U
- Medir intervalos: PR, QRS, QT, QTc (Bazett: QTc = QT/√RR)
- Calcular relação R/S nas precordiais (progressão R V1→V6)
- Identificar zona de transição precordial

FASE 4 — INTERPRETAÇÃO DA FAIXA DE RITMO (Rhythm Strip):
- Analisar DII longo ou faixa de ritmo inferior
- Determinar ritmo: sinusal, atrial, juncional, ventricular, ou marca-passo
- Avaliar regularidade R-R (regular, regularmente irregular, irregularmente irregular)
- Calcular FC: método 300/quadrados grandes ou método 6 segundos
- Identificar: extrassístoles (APCs/PVCs), pausas, condução aberrante
- Avaliar relação P:QRS (1:1, >1:1 para bloqueios, <1:1 para dissociação)

FASE 5 — DETERMINAÇÃO DO EIXO ELÉTRICO:
- Calcular eixo QRS pelo método quadrante (DI + aVF) e método perpendicular
- Normal: -30° a +90° | Desvio esquerdo: -30° a -90° | Desvio direito: +90° a +180°
- Determinar eixo da onda P e eixo da onda T
- Avaliar concordância ou discordância dos eixos

FASE 6 — CORRELAÇÃO CLÍNICA E PADRÕES DIAGNÓSTICOS:
- Aplicar critérios de Sokolow-Lyon e Cornell para HVE
- Critérios de sobrecarga atrial (P mitrale, P pulmonale)
- Padrões isquêmicos: ST-T em territórios coronarianos (anterior, inferior, lateral, posterior)
- Critérios de bloqueio de ramo (BRD: rSR' em V1, BRE: QS/rS em V1 + R monofásico em V5-V6)
- Critérios de Sgarbossa para IAMCSST com BRE
- Padrões especiais: Brugada, WPW (delta), QT longo, repolarização precoce, pericardite

FASE 7 — SÍNTESE DIAGNÓSTICA COM EVIDÊNCIAS:
- Formular diagnóstico presuntivo com nível de confiança baseado em guidelines AHA/ESC/SBC
- Listar diagnósticos diferenciais com probabilidades baseadas em evidências
- Referências epidemiológicas (prevalência, incidência, mortalidade)
- Plano de ação estratificado por urgência

ANÁLISE SISTEMÁTICA EM 9 CRITÉRIOS (com valores de referência):
1. RITMO: Avaliar regularidade R-R, presença/morfologia de ondas P antes de cada QRS
2. FREQUÊNCIA CARDÍACA: Calcular FC (normal: 60-100 bpm)
3. EIXO QRS: Determinar eixo elétrico (normal: -30° a +90°)
4. ONDA P: Morfologia, duração (<0,12s), amplitude (<2,5mm em DII)
5. INTERVALO PR: Duração (normal: 0,12-0,20s)
6. COMPLEXO QRS: Largura (<0,12s), morfologia, amplitude
7. SEGMENTO ST: Isoelétrico vs supra/infradesnivelamento em mm
8. ONDA T: Morfologia, simetria, inversões
9. INTERVALO QT: QTc (normal: <440ms H, <460ms M)

REGRAS:
- Marcar cada alteração com % descritivo (ex: "ST supradesnivelado 2mm em V1-V4 - 80% probabilidade de IAM anterior")
- Incluir dados epidemiológicos da literatura (guidelines AHA/ESC/SBC)
- Usar cores semânticas:
  * Vermelho (#EF4444) = isquemia/infarto/alto risco
  * Azul (#3B82F6) = hipertrofia/distúrbios de condução
  * Verde (#22C55E) = normalidade/variante normal
  * Amarelo (#EAB308) = risco moderado (pericardite, distúrbios eletrolíticos)
  * Roxo (#8B5CF6) = arritmias

IMPORTANTE: Responda inteiramente em PORTUGUÊS MÉDICO. Retorne APENAS JSON válido com TODAS estas chaves:

{
  "ecg_metrics": { "heart_rate": "string com valor e classificação", "rhythm": "string", "qrs_width": "string com valor em ms", "atrial_activity": "string", "signal_quality": "string" },
  "lead_by_lead_analysis": {
    "DI": "achados nesta derivação",
    "DII": "achados nesta derivação",
    "DIII": "achados nesta derivação",
    "aVR": "achados nesta derivação",
    "aVL": "achados nesta derivação",
    "aVF": "achados nesta derivação",
    "V1": "achados nesta derivação",
    "V2": "achados nesta derivação",
    "V3": "achados nesta derivação",
    "V4": "achados nesta derivação",
    "V5": "achados nesta derivação",
    "V6": "achados nesta derivação"
  },
  "waveform_segmentation": {
    "p_wave": "morfologia, duração, amplitude geral",
    "pr_interval": "medida e interpretação",
    "qrs_complex": "duração, morfologia, progressão R",
    "st_segment": "alterações, quantificação em mm por território",
    "t_wave": "morfologia, inversões, concordância",
    "qt_interval": "QT medido, QTc calculado por Bazett",
    "u_wave": "presença e significância"
  },
  "rhythm_strip_interpretation": "Análise detalhada da faixa de ritmo: regularidade, relação P:QRS, extrassístoles, pausas",
  "cardiac_interpretation": "Texto detalhado explicando o que este ECG indica sobre a condição, função e atividade elétrica do coração",
  "key_findings": ["array dos achados clínicos mais importantes, cada um como string com % descritivo"],
  "systematic_analysis": {
    "ritmo": { "finding": "achado", "normal_range": "Ritmo sinusal regular", "is_normal": true/false, "clinical_significance": "significância", "percentage_descriptor": "ex: 95% compatível com ritmo sinusal" },
    "frequencia_cardiaca": { "finding": "XX bpm", "normal_range": "60-100 bpm", "is_normal": true/false, "clinical_significance": "significância", "percentage_descriptor": "%" },
    "eixo_qrs": { "finding": "eixo em graus", "normal_range": "-30° a +90°", "is_normal": true/false, "clinical_significance": "significância", "percentage_descriptor": "%" },
    "onda_p": { "finding": "achado", "normal_range": "<0,12s duração, <2,5mm amplitude", "is_normal": true/false, "clinical_significance": "significância", "percentage_descriptor": "%" },
    "intervalo_pr": { "finding": "valor em ms/s", "normal_range": "0,12-0,20s", "is_normal": true/false, "clinical_significance": "significância", "percentage_descriptor": "%" },
    "complexo_qrs": { "finding": "achado com valor", "normal_range": "<0,12s", "is_normal": true/false, "clinical_significance": "significância", "percentage_descriptor": "%" },
    "segmento_st": { "finding": "achado com quantificação em mm", "normal_range": "Isoelétrico", "is_normal": true/false, "clinical_significance": "significância", "percentage_descriptor": "%" },
    "onda_t": { "finding": "achado", "normal_range": "Concordante com QRS", "is_normal": true/false, "clinical_significance": "significância", "percentage_descriptor": "%" },
    "intervalo_qt": { "finding": "QTc valor", "normal_range": "<440ms (H) / <460ms (M)", "is_normal": true/false, "clinical_significance": "significância", "percentage_descriptor": "%" }
  },
  "epidemiological_data": [{ "finding": "achado", "prevalence": "prevalência na população", "source": "AHA/ESC/SBC guideline reference" }],
  "color_coded_annotations": [{ "region": "região do ECG", "color_hex": "#hex", "color_name": "nome da cor", "hypothesis": "hipótese diagnóstica", "probability": "XX%", "description": "descrição" }],
  "presumptive_diagnosis": { "name": "Diagnóstico principal", "confidence": "XX%", "color": "#hex", "reasoning": "Raciocínio clínico baseado em guidelines" },
  "differential_diagnoses": [{ "name": "Diagnóstico alternativo", "confidence": "XX%", "color": "#hex", "reasoning": "Raciocínio breve com referência a literatura", "key_indicators": ["indicador clínico curto 1", "indicador clínico curto 2"] }],
  "action_plan": { "immediate_actions": ["ações imediatas"], "follow_up": ["acompanhamento"], "monitoring": ["monitoramento"] },
  "clinical_comment": "O que é MAIS IMPORTANTE sobre este ECG - comentário destacado do achado principal e sua urgência",
  "recommended_conduct": "Plano de ação detalhado: exames, medicações se aplicável, monitoramento e seguimento",
  "severity_level": { "level": 1-5, "label": "Baixo/Moderado/Alto/Muito Alto/Crítico", "description": "Justificativa da gravidade" },
  "technical_report": "Laudo técnico formal completo com todos parâmetros medidos, intervalos, achados morfológicos, conclusão clínica e recomendações, padrão CBR/RSNA",
  "diagnosis_probabilities": { "nome_diagnostico": "XX%" },
  "visual_annotation_instructions": { "nome_achado": "cor_para_destaque" },
  "technical_summary": "Resumo técnico conciso",
  "simple_summary": "Resumo acessível ao paciente dos achados",
  "disclaimer": "Disclaimer médico sobre análise automatizada"
}

severity_level.level: 1=Baixo, 2=Moderado, 3=Alto, 4=Muito Alto, 5=Crítico.
Forneça pelo menos 3-5 diagnósticos diferenciais com probabilidades baseadas em evidências.
Seja extremamente detalhado e didático. Referencie guidelines AHA/ESC/SBC quando possível.`;

    const normalizeECGResult = (raw: any) => {
      const normalizeSysItem = (item: any) => ({
        finding: item?.finding ?? 'Não avaliado',
        normal_range: item?.normal_range ?? '',
        is_normal: item?.is_normal ?? true,
        clinical_significance: item?.clinical_significance ?? '',
        percentage_descriptor: item?.percentage_descriptor ?? '',
      });
      return {
        ecg_metrics: {
          heart_rate: raw?.ecg_metrics?.heart_rate ?? 'Não determinado',
          rhythm: raw?.ecg_metrics?.rhythm ?? 'Não determinado',
          qrs_width: raw?.ecg_metrics?.qrs_width ?? 'Não determinado',
          atrial_activity: raw?.ecg_metrics?.atrial_activity ?? 'Não determinado',
          signal_quality: raw?.ecg_metrics?.signal_quality ?? 'Não determinado',
        },
        lead_by_lead_analysis: raw?.lead_by_lead_analysis ?? {},
        waveform_segmentation: {
          p_wave: raw?.waveform_segmentation?.p_wave ?? 'Não avaliado',
          pr_interval: raw?.waveform_segmentation?.pr_interval ?? 'Não avaliado',
          qrs_complex: raw?.waveform_segmentation?.qrs_complex ?? 'Não avaliado',
          st_segment: raw?.waveform_segmentation?.st_segment ?? 'Não avaliado',
          t_wave: raw?.waveform_segmentation?.t_wave ?? 'Não avaliado',
          qt_interval: raw?.waveform_segmentation?.qt_interval ?? 'Não avaliado',
          u_wave: raw?.waveform_segmentation?.u_wave ?? 'Não avaliado',
        },
        rhythm_strip_interpretation: raw?.rhythm_strip_interpretation ?? 'Interpretação da faixa de ritmo não disponível.',
        cardiac_interpretation: raw?.cardiac_interpretation ?? 'Interpretação cardíaca não disponível.',
        key_findings: Array.isArray(raw?.key_findings) ? raw.key_findings : [],
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
          ? raw.epidemiological_data.map((e: any) => ({
              finding: e?.finding ?? '',
              prevalence: e?.prevalence ?? '',
              source: e?.source ?? '',
            }))
          : [],
        color_coded_annotations: Array.isArray(raw?.color_coded_annotations)
          ? raw.color_coded_annotations.map((a: any) => ({
              region: a?.region ?? '',
              color_hex: a?.color_hex ?? '#6B7280',
              color_name: a?.color_name ?? '',
              hypothesis: a?.hypothesis ?? '',
              probability: a?.probability ?? '0%',
              description: a?.description ?? '',
            }))
          : [],
        presumptive_diagnosis: {
          name: raw?.presumptive_diagnosis?.name ?? 'Não determinado',
          confidence: raw?.presumptive_diagnosis?.confidence ?? '0%',
          color: raw?.presumptive_diagnosis?.color ?? '#3B82F6',
          reasoning: raw?.presumptive_diagnosis?.reasoning ?? '',
        },
        differential_diagnoses: Array.isArray(raw?.differential_diagnoses)
          ? raw.differential_diagnoses.map((d: any) => ({
              name: d?.name ?? 'Diagnóstico alternativo',
              confidence: d?.confidence ?? '0%',
              color: d?.color ?? '#6B7280',
              reasoning: d?.reasoning ?? '',
              key_indicators: Array.isArray(d?.key_indicators) ? d.key_indicators : [],
            }))
          : [],
        action_plan: {
          immediate_actions: Array.isArray(raw?.action_plan?.immediate_actions) ? raw.action_plan.immediate_actions : [],
          follow_up: Array.isArray(raw?.action_plan?.follow_up) ? raw.action_plan.follow_up : [],
          monitoring: Array.isArray(raw?.action_plan?.monitoring) ? raw.action_plan.monitoring : [],
        },
        clinical_comment: raw?.clinical_comment ?? '',
        recommended_conduct: raw?.recommended_conduct ?? 'Conduta recomendada não disponível.',
        severity_level: {
          level: raw?.severity_level?.level ?? 1,
          label: raw?.severity_level?.label ?? 'Não classificado',
          description: raw?.severity_level?.description ?? '',
        },
        technical_report: raw?.technical_report ?? 'Laudo técnico não disponível.',
        diagnosis_probabilities: raw?.diagnosis_probabilities ?? {},
        visual_annotation_instructions: raw?.visual_annotation_instructions ?? {},
        technical_summary: raw?.technical_summary ?? 'Análise técnica não disponível.',
        simple_summary: raw?.simple_summary ?? 'Resumo simplificado não disponível.',
        disclaimer: raw?.disclaimer ?? 'Análise automatizada por IA. Requer revisão e validação médica profissional. Não substitui avaliação clínica presencial.',
      };
    };

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
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
      ]);

      const text = response.response.text();
      const parsed = JSON.parse(text);
      return normalizeECGResult(parsed);
    } catch (err) {
      geminiError = err;
      console.error('Gemini ECG analysis error:', err instanceof Error ? err.message : err);
    }

    console.log('Falling back to OpenAI for ECG analysis...');
    try {
      const openai = getOpenAIFallback();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta imagem de ECG. Dados do paciente: ${patientInfo || 'Não informado'}. Retorne JSON estruturado conforme o schema solicitado.`,
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
        max_tokens: 8000,
        temperature: 0.2,
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return normalizeECGResult(parsed);
    } catch (openaiError) {
      console.error('OpenAI fallback ECG analysis also failed:', openaiError instanceof Error ? openaiError.message : openaiError);
      throw geminiError || openaiError;
    }
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

    const prompt = `Você é um sistema de inteligência radiológica sênior de nível hospitalar, equivalente a um radiologista subespecialista, integrando raciocínio diagnóstico, priorização clínica, interpretação biomecânica, modelagem prognóstica e visualização educacional.

ENTRADA: Radiografia médica com contexto clínico [${patientInfo}].

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
• Vermelho (#EF4444) = alto risco clínico / achado principal
• Laranja (#F97316) = risco moderado / achado secundário
• Amarelo (#EAB308) = envolvimento secundário
• Azul (#3B82F6) = referência anatômica
• Verde (#22C55E) = comparação normal / anatomia preservada
• Roxo (#8B5CF6) = achado incidental

IMPORTANTE: Responda inteiramente em PORTUGUÊS MÉDICO. Retorne APENAS JSON válido com TODAS estas chaves:

{
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
  "educational_note": { "quality_score": 1-5, "quality_assessment": "avaliação da qualidade técnica", "didactic_note": "nota educacional sobre o caso", "next_steps": "próximas evoluções sugeridas" },
  "severity_level": { "level": 1-5, "label": "Baixo/Moderado/Alto/Muito Alto/Crítico", "description": "justificativa da gravidade" },
  "recommended_conduct": "Conduta detalhada: exames complementares, encaminhamentos, monitoramento",
  "multi_specialty_relevance": [{ "specialty": "especialidade", "relevance": "por que é relevante", "urgency": "baixa/média/alta/urgente" }],
  "technical_quality": { "projection": "tipo de projeção", "rotation": "avaliação", "centering": "avaliação", "penetration": "avaliação", "collimation": "avaliação", "artifacts": "artefatos identificados", "score": 1-5 },
  "color_coded_regions": [{ "region": "região", "color_hex": "#hex", "color_name": "cor", "finding": "achado", "risk_level": "alto/moderado/baixo" }],
  "clinical_comment": "O que é MAIS IMPORTANTE sobre esta radiografia",
  "action_plan": { "immediate_actions": ["ações imediatas"], "follow_up": ["acompanhamento"], "monitoring": ["monitoramento"] },
  "disclaimer": "Disclaimer médico"
}

severity_level.level: 1=Baixo, 2=Moderado, 3=Alto, 4=Muito Alto, 5=Crítico.
Seja extremamente detalhado, didático e baseado em evidências. Use padrão CBR/RSNA para o laudo formal.`;

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
        model: 'gpt-4o-mini',
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
  async generateRadiologyPACSImage(analysisData: any): Promise<string | null> {
    try {
      const { generateImageBuffer } = await import('../replit_integrations/image/client');
      const imagePrompt = await this.generateRadiologyPACSImagePrompt(analysisData);
      const imageBuffer = await generateImageBuffer(imagePrompt, '1024x1024');
      console.log('Radiology immersive PACS image generated via service');
      return imageBuffer.toString('base64');
    } catch (error) {
      console.error('generateRadiologyPACSImage error (non-blocking):', error instanceof Error ? error.message : error);
      return null;
    }
  }

  async generateRadiologyPACSImagePrompt(analysisData: any): Promise<string> {
    const findings = analysisData.radiology_findings || {};
    const diagnosis = analysisData.probabilistic_diagnosis?.presumptive?.name || 'Estudo Radiológico';
    const severity = analysisData.severity_level?.label || 'Moderado';
    const region = findings.anatomical_region || 'Região não especificada';
    const laterality = findings.laterality || 'N/A';
    const dominantPathology = findings.dominant_pathology || 'Achado não identificado';
    const impactPct = findings.clinical_impact_percentage || '0%';
    const formalReport = analysisData.formal_report || {};
    const laySummary = (analysisData.lay_summary || []).join(' ');
    const colorRegions = (analysisData.color_coded_regions || []).slice(0, 6).map((r: any) =>
      `"${r.region}": ${r.finding} (${r.color_name} ${r.color_hex}, risco: ${r.risk_level})`
    ).join('. ');
    const differentials = (analysisData.probabilistic_diagnosis?.differentials || []).slice(0, 4).map((d: any) =>
      `${d.name}: ${d.confidence}`
    ).join(', ');
    const prognostic = analysisData.prognostic_estimation || {};
    const techQuality = analysisData.technical_quality || {};

    return `Create an immersive PACS-style radiology workstation visual panel — a hyper-realistic medical image synthesis for radiology educational interface. Dark hospital interface background (#1a1a2e).

ALL TEXT MUST BE IN PORTUGUESE (BRAZIL). Use large, bold, high-contrast fonts (minimum 16pt equivalent). White text on dark backgrounds. Avoid small or condensed text. Prioritize legibility over density.

STYLE: Advanced medical workstation UI, RSNA teaching atlas hybrid, AI diagnostic heatmap overlay, ultra-clean vector + radiograph fusion.

VISUAL LAYOUT — 6 BLOCKS:

BLOCK 1 (TOP LEFT) — "RX ORIGINAL":
- Show a stylized radiograph of "${region}" with "${laterality}" laterality
- Highlight the dominant pathology "${dominantPathology}" with an organic RED polygon overlay
- Caption: "Achado principal: ${dominantPathology} (~${impactPct} impacto clínico)"

BLOCK 2 (TOP CENTER) — "OVERLAY TOPOGRÁFICO":
- Same radiograph base with transparent anatomical mapping overlay
- AI-style pathological heatmap gradient (orange to intense red) focused on pathology area
- Up to 8 critical structures with connected white arrows
- Probabilistic relevance percentage labels on key structures

BLOCK 3 (TOP RIGHT) — "ANATOMIA NORMAL COMPARATIVA":
- Clean anatomical medical illustration of normal "${region}" for comparison
- Green highlights showing healthy anatomical landmarks
- Label: "Referência Atlas"

BLOCK 4 (BOTTOM LEFT) — "IMAGEM ANATÔMICA FUNCIONAL":
- Biomechanical/pathological conceptual illustration
- Show stress zones, instability, degeneration, or deformity relevant to "${dominantPathology}"
- Compare normal (verde) vs pathological (vermelho/laranja) with clear labels
- Bold laterality marker: "${laterality}"

BLOCK 5 (BOTTOM CENTER) — DADOS ESTRUTURADOS:
- "ESTIMATIVA PROGNÓSTICA": Gravidade: ${prognostic.severity_score || severity}, Risco progressão: ${prognostic.functional_progression_risk || 'N/A'}, Risco intervenção: ${prognostic.intervention_risk || 'N/A'}
- "DIAGNÓSTICO DIFERENCIAL": ${differentials}
- "LAUDO FORMAL": Exame: ${formalReport.exam || region}, Impressão: ${formalReport.diagnostic_impression || diagnosis}
- "RESUMO LEIGO": ${laySummary}

BLOCK 6 (BOTTOM RIGHT) — RESUMO CLÍNICO:
- Qualidade técnica: ${techQuality.score || 3}/5
- Nota educacional
- Barra inferior vermelha: "Correlacione clinicamente. Relevância %, prognóstico, DDx e conduta incluídos."

TOP BANNER: "RESUMO CLÍNICO-RADIOLÓGICO IMERSIVO: ${region} — ${dominantPathology}" in white/red text.

COLOR SEMANTICS: Vermelho = alto risco clínico, Laranja = risco moderado, Amarelo = secundário, Azul = referência anatômica, Verde = comparação normal.

Regiões coloridas da análise: ${colorRegions}

GRAPHICAL RULES: Organic medical polygons, thin clinical arrows, no decorative elements, high contrast clinical readability, real radiology workstation appearance. All text in Portuguese. Prioritize font size and legibility over information density.

Generate ONE single integrated immersive medical radiology panel.`;
  }
}

export const geminiService = new GeminiService();
