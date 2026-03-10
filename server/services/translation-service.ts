import { geminiService } from './gemini';

const translationCache = new Map<string, any>();

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  it: 'Italian (Italiano)',
  zh: 'Chinese Simplified (中文简体)',
  gn: 'Guaraní (Avañe\'ẽ)'
};

const PROPER_NAMES = [
  'Tele<M3D>', 'TeleM3D', 'Tele<M3D> Pro', 'IAM3D', 'TM3D', 'TMC',
  'PayPal', 'Stripe', 'PagBank', 'Agora.io', 'Agora',
  'FHIR R4', 'FHIR', 'HL7', 'Manchester', 'LGPD', 'HIPAA', 'GDPR',
  'CFM', 'CRM', 'CRF', 'ANVISA', 'RENAME', 'RxNorm', 'OpenFDA',
  'DSM-5', 'DSM-5-TR', 'CID-10', 'CID-11', 'SAMU', 'SOAP',
  'QR Code', 'WebSocket', 'MetaMask', 'WalletConnect', 'NFT', 'PMD',
  'RGPD', 'RNDS', 'RAC', 'SBIS', 'USCDI', 'SNOMED', 'MeSH', 'ICD',
  'OCSP', 'RSA-PSS', 'RSA-SHA256', 'ICP-Brasil', 'PIX', 'Boleto',
  'TLS', 'AES-256', 'RBAC', 'HSM', 'React', 'TypeScript', 'Tailwind',
  'Express', 'PostgreSQL', 'Neon', 'Drizzle', 'Wouter', 'TanStack',
  'shadcn', 'Gemini', 'OpenAI', 'GPT-4o-mini', 'i18next', 'Google',
  'Apple Pay', 'Docker', 'Node.js', 'Chrome', 'Edge', 'Firefox', 'Safari',
  'macOS', 'CONITEC', 'PCDT', 'PDF', 'JSON', 'XML', 'CSV', 'HTTPS',
  'WSS', 'API', 'REST', 'SDK', 'MedPro', 'Cybermedicina',
  'Harrison', 'WhatsApp', 'GINA', 'GOLD', 'mhGAP'
];

export async function translateContent(
  content: any,
  targetLang: string,
  cacheKey: string
): Promise<any> {
  if (targetLang === 'pt') return content;

  const fullKey = `${cacheKey}:${targetLang}`;
  if (translationCache.has(fullKey)) {
    return translationCache.get(fullKey);
  }

  const langName = LANG_NAMES[targetLang];
  if (!langName) return content;

  const jsonStr = JSON.stringify(content);

  const prompt = `You are a professional medical software translator. Translate the following JSON content from Brazilian Portuguese to ${langName}.

STRICT RULES:
1. Only translate string VALUES — never modify JSON keys, structure, booleans, numbers, or null values
2. Do NOT translate these proper names/acronyms (keep them exactly as-is): ${PROPER_NAMES.join(', ')}
3. Preserve all markdown formatting: **, -, numbered lists (1. 2. 3.), line breaks (\\n)
4. Preserve all emoji characters exactly as-is
5. Medical terminology should use the official standard terminology in ${langName}
6. Return ONLY valid JSON — no explanations, no code blocks, no markdown wrapping

JSON to translate:
${jsonStr}`;

  try {
    const result = await geminiService.generateWithJSON(prompt);
    translationCache.set(fullKey, result);
    return result;
  } catch (error) {
    console.error(`Translation error for ${fullKey}:`, error);
    try {
      const textResult = await geminiService.generateText(prompt);
      let cleaned = textResult.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      const parsed = JSON.parse(cleaned.trim());
      translationCache.set(fullKey, parsed);
      return parsed;
    } catch (fallbackError) {
      console.error(`Translation fallback also failed for ${fullKey}:`, fallbackError);
      return content;
    }
  }
}

export function clearTranslationCache(): void {
  translationCache.clear();
}
