import crypto from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { geminiService } from './gemini';
import { db } from '../db';
import { uiTranslations } from '@shared/schema';

const translationCache = new Map<string, any>();

// Hot in-memory layer over the ui_translations DB cache: `${hash}:${lang}` → translated
const segmentMemoryCache = new Map<string, string>();
const SEGMENT_MEMORY_CACHE_MAX = 50000;
const AI_CHUNK_SIZE = 40;

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
  segmentMemoryCache.clear();
}

function hashSegment(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function buildSegmentPrompt(chunk: string[], langName: string): string {
  return `You are a professional medical software translator. Translate each string in the JSON array below from Brazilian Portuguese to ${langName}.

STRICT RULES:
1. Return ONLY a JSON object of the exact form {"translations": ["...", "..."]} containing exactly ${chunk.length} strings, in the same order as the input array
2. If a string is already in ${langName}, or is untranslatable (a number, a code, a proper name), return it unchanged
3. Do NOT translate these proper names/acronyms (keep them exactly as-is): ${PROPER_NAMES.join(', ')}
4. Preserve punctuation, emoji, and interpolation placeholders like {{name}} exactly as-is
5. Match the capitalization style of each source string (e.g. title case stays title case)
6. Medical terminology must use the official standard terminology in ${langName}

Input array:
${JSON.stringify(chunk)}`;
}

/**
 * Translate an array of short UI text segments pt-BR → targetLang.
 * Resolution order: in-memory cache → ui_translations table → AI (Gemini
 * with OpenAI fallback). Newly AI-translated segments are persisted so any
 * future user/page load gets them without an AI call. On AI failure the
 * original segments are returned unchanged (graceful degradation) and NOT
 * cached, so they can be retried later.
 */
export async function translateSegments(texts: string[], targetLang: string): Promise<string[]> {
  if (targetLang === 'pt' || texts.length === 0) return texts;
  const langName = LANG_NAMES[targetLang];
  if (!langName) return texts;

  const unique = Array.from(new Set(texts));
  const hashByText = new Map<string, string>();
  for (const t of unique) hashByText.set(t, hashSegment(t));

  const resolved = new Map<string, string>();

  // 1. In-memory hot cache
  const memoryMisses: string[] = [];
  for (const t of unique) {
    const hit = segmentMemoryCache.get(`${hashByText.get(t)}:${targetLang}`);
    if (hit !== undefined) resolved.set(t, hit);
    else memoryMisses.push(t);
  }

  // 2. Persistent DB cache
  let dbMisses: string[] = [];
  if (memoryMisses.length > 0) {
    try {
      const rows = await db
        .select({ sourceHash: uiTranslations.sourceHash, translatedText: uiTranslations.translatedText })
        .from(uiTranslations)
        .where(and(
          eq(uiTranslations.targetLang, targetLang),
          inArray(uiTranslations.sourceHash, memoryMisses.map(t => hashByText.get(t)!)),
        ));
      const byHash = new Map(rows.map(r => [r.sourceHash, r.translatedText]));
      for (const t of memoryMisses) {
        const hit = byHash.get(hashByText.get(t)!);
        if (hit !== undefined) {
          resolved.set(t, hit);
          rememberSegment(`${hashByText.get(t)}:${targetLang}`, hit);
        } else {
          dbMisses.push(t);
        }
      }
    } catch (error) {
      console.error('ui_translations cache lookup failed:', error);
      dbMisses = memoryMisses;
    }
  }

  // 3. AI translation for the remaining misses, in bounded chunks
  const newRows: { sourceHash: string; targetLang: string; sourceText: string; translatedText: string }[] = [];
  for (let i = 0; i < dbMisses.length; i += AI_CHUNK_SIZE) {
    const chunk = dbMisses.slice(i, i + AI_CHUNK_SIZE);
    const prompt = buildSegmentPrompt(chunk, langName);
    let arr: unknown = null;
    try {
      const result = await geminiService.generateWithJSON(prompt);
      arr = Array.isArray(result) ? result : result?.translations;
    } catch (error) {
      console.error(`Batch segment translation failed (${targetLang}):`, error);
    }
    if (Array.isArray(arr) && arr.length === chunk.length) {
      chunk.forEach((t, idx) => {
        const candidate = arr as unknown[];
        const translated = typeof candidate[idx] === 'string' && (candidate[idx] as string).trim()
          ? (candidate[idx] as string)
          : t;
        resolved.set(t, translated);
        rememberSegment(`${hashByText.get(t)}:${targetLang}`, translated);
        newRows.push({
          sourceHash: hashByText.get(t)!,
          targetLang,
          sourceText: t,
          translatedText: translated,
        });
      });
    } else {
      // Malformed/failed AI response — return originals, don't cache
      for (const t of chunk) resolved.set(t, t);
    }
  }

  // 4. Persist newly translated segments
  if (newRows.length > 0) {
    try {
      await db.insert(uiTranslations).values(newRows).onConflictDoNothing();
    } catch (error) {
      console.error('Failed to persist ui_translations rows:', error);
    }
  }

  return texts.map(t => resolved.get(t) ?? t);
}

function rememberSegment(key: string, value: string): void {
  if (segmentMemoryCache.size >= SEGMENT_MEMORY_CACHE_MAX) {
    // Simple eviction: drop the oldest half of entries
    const keys = Array.from(segmentMemoryCache.keys()).slice(0, SEGMENT_MEMORY_CACHE_MAX / 2);
    for (const k of keys) segmentMemoryCache.delete(k);
  }
  segmentMemoryCache.set(key, value);
}
