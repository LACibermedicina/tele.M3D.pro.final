import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// AutoTranslate — global AI page translation engine.
//
// When the user picks a non-Portuguese language flag, this engine walks the
// visible DOM, collects Portuguese text segments, translates them in batches
// through /api/ai/translate-batch (Gemini with OpenAI fallback, cached in
// PostgreSQL) and swaps the translated text in place. A MutationObserver
// keeps newly loaded pages, desktop windows, dialogs and dropdowns
// translated as they appear. Selecting Portuguese restores the originals
// and stops all observation — nothing is ever translated before a flag is
// chosen.
//
// Opt-out: add `data-no-translate` to any element to keep its whole subtree
// untouched (use for user-generated/clinical content).
// ============================================================================

const SKIP_SELECTOR = 'script,style,noscript,textarea,code,pre,svg,[data-no-translate]';
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label'] as const;
const MAX_SEGMENT_LEN = 600;
const BATCH_SIZE = 90;
const FLUSH_DEBOUNCE_MS = 250;
const SAVE_DEBOUNCE_MS = 1500;
const ERROR_BACKOFF_MS = 30_000;
const LS_PREFIX = 'ai-auto-translate:';
const LS_MAX_ENTRIES = 4000;

const HAS_LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

interface TextState {
  raw: string;        // original full nodeValue (whitespace preserved)
  trimmed: string;    // segment sent for translation
  leading: string;
  trailing: string;
  applied: string | null; // full nodeValue we set, null = not yet translated
}

interface AttrState {
  original: string;
  applied: string | null;
}

function splitWhitespace(raw: string): { leading: string; trimmed: string; trailing: string } {
  const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return { leading: m?.[1] ?? '', trimmed: m?.[2] ?? raw, trailing: m?.[3] ?? '' };
}

function isTranslatableSegment(trimmed: string): boolean {
  return trimmed.length >= 2 && trimmed.length <= MAX_SEGMENT_LEN && HAS_LETTER.test(trimmed);
}

function isSkippedElement(el: Element | null): boolean {
  if (!el) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // NOTE: deliberately NOT using [translate="no"] — the <html> element carries
  // it globally (to block Google Translate) and would skip everything.
  return el.closest(SKIP_SELECTOR) !== null;
}

class AutoTranslator {
  private lang = 'pt';
  private observer: MutationObserver | null = null;
  private textNodes = new Map<Text, TextState>();
  private attrStates = new Map<Element, Map<string, AttrState>>();
  private cache = new Map<string, string>();   // trimmed → translated (current lang)
  private pending = new Set<string>();
  private inFlight = new Set<string>();
  private failed = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private errorBackoffUntil = 0;
  private cacheDirty = false;

  setLanguage(lang: string): void {
    if (lang === this.lang) return;
    this.stop();
    this.restoreAll();
    this.lang = lang;
    this.cache = new Map();
    this.pending.clear();
    this.inFlight.clear();
    this.failed.clear();
    this.errorBackoffUntil = 0;
    if (lang === 'pt') return;
    this.loadCacheFromStorage();
    this.start();
  }

  private start(): void {
    if (!document.body) return;
    this.scanElement(document.body);
    this.applyAll();
    this.observer = new MutationObserver((muts) => this.onMutations(muts));
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  private stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
  }

  // ---- scanning -----------------------------------------------------------

  private scanElement(root: Element): void {
    if (isSkippedElement(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || isSkippedElement(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n: Node | null;
    while ((n = walker.nextNode())) {
      this.registerTextNode(n as Text);
    }
    // Translatable attributes (scan-time only; not observed for mutations)
    const attrTargets: Element[] = [];
    if (root.matches?.('[placeholder],[title],[aria-label]')) attrTargets.push(root);
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach((el) => attrTargets.push(el));
    for (const el of attrTargets) {
      if (isSkippedElement(el)) continue;
      for (const attr of TRANSLATABLE_ATTRS) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        const trimmed = value.trim();
        if (!isTranslatableSegment(trimmed)) continue;
        let map = this.attrStates.get(el);
        if (!map) { map = new Map(); this.attrStates.set(el, map); }
        const existing = map.get(attr);
        if (existing && (value === existing.original || value === existing.applied)) continue;
        map.set(attr, { original: value, applied: null });
        this.queueSegment(trimmed);
      }
    }
  }

  private registerTextNode(node: Text): void {
    const raw = node.nodeValue ?? '';
    const { leading, trimmed, trailing } = splitWhitespace(raw);
    if (!isTranslatableSegment(trimmed)) {
      this.textNodes.delete(node);
      return;
    }
    this.textNodes.set(node, { raw, trimmed, leading, trailing, applied: null });
    this.queueSegment(trimmed);
  }

  // ---- translation queue --------------------------------------------------

  private queueSegment(trimmed: string): void {
    if (this.cache.has(trimmed) || this.inFlight.has(trimmed) || this.failed.has(trimmed)) return;
    this.pending.add(trimmed);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    const delay = Math.max(FLUSH_DEBOUNCE_MS, this.errorBackoffUntil - Date.now());
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, delay);
  }

  private async flush(): Promise<void> {
    if (this.lang === 'pt' || this.pending.size === 0) return;
    const lang = this.lang;
    const batch = Array.from(this.pending).slice(0, BATCH_SIZE);
    batch.forEach((s) => { this.pending.delete(s); this.inFlight.add(s); });

    try {
      const res = await fetch('/api/ai/translate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: batch, targetLang: lang }),
      });
      if (!res.ok) throw new Error(`translate-batch HTTP ${res.status}`);
      const data = await res.json();
      if (this.lang !== lang) return; // language changed mid-flight — discard
      const translations: unknown = data?.translations;
      if (Array.isArray(translations) && translations.length === batch.length) {
        batch.forEach((original, i) => {
          const t = translations[i];
          this.cache.set(original, typeof t === 'string' && t.trim() ? t : original);
        });
        this.cacheDirty = true;
        this.applyAll();
        this.scheduleSave();
      } else {
        batch.forEach((s) => this.failed.add(s));
      }
    } catch (err) {
      if (this.lang === lang) {
        // Graceful degradation: keep originals, retry this batch later
        batch.forEach((s) => this.pending.add(s));
        this.errorBackoffUntil = Date.now() + ERROR_BACKOFF_MS;
        console.warn('Auto-translate batch failed, backing off:', err);
      }
    } finally {
      batch.forEach((s) => this.inFlight.delete(s));
      if (this.lang === lang && this.pending.size > 0) this.scheduleFlush();
    }
  }

  // ---- applying -----------------------------------------------------------

  private applyAll(): void {
    this.textNodes.forEach((state, node) => {
      if (!node.isConnected) { this.textNodes.delete(node); return; }
      if (state.applied !== null) return;
      const translated = this.cache.get(state.trimmed);
      if (translated === undefined) return;
      const full = state.leading + translated + state.trailing;
      state.applied = full;
      if (node.nodeValue !== full) node.nodeValue = full;
    });
    this.attrStates.forEach((map, el) => {
      if (!el.isConnected) { this.attrStates.delete(el); return; }
      map.forEach((state, attr) => {
        if (state.applied !== null) return;
        const translated = this.cache.get(state.original.trim());
        if (translated === undefined) return;
        state.applied = translated;
        if (el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
      });
    });
  }

  private restoreAll(): void {
    this.textNodes.forEach((state, node) => {
      if (node.isConnected && state.applied !== null && node.nodeValue === state.applied) {
        node.nodeValue = state.raw;
      }
    });
    this.attrStates.forEach((map, el) => {
      if (!el.isConnected) return;
      map.forEach((state, attr) => {
        if (state.applied !== null && el.getAttribute(attr) === state.applied) {
          el.setAttribute(attr, state.original);
        }
      });
    });
    this.textNodes.clear();
    this.attrStates.clear();
  }

  // ---- mutation handling ----------------------------------------------------

  private onMutations(muts: MutationRecord[]): void {
    for (const mut of muts) {
      if (mut.type === 'characterData' && mut.target.nodeType === Node.TEXT_NODE) {
        const node = mut.target as Text;
        const state = this.textNodes.get(node);
        // Ignore mutations we caused ourselves
        if (state && node.nodeValue === state.applied) continue;
        const parent = node.parentElement;
        if (!parent || isSkippedElement(parent)) continue;
        // React re-rendered this node (or new content) — re-register + retranslate
        this.registerTextNode(node);
      } else if (mut.type === 'childList') {
        mut.addedNodes.forEach((added) => {
          if (added.nodeType === Node.ELEMENT_NODE) {
            this.scanElement(added as Element);
          } else if (added.nodeType === Node.TEXT_NODE) {
            const parent = (added as Text).parentElement;
            if (parent && !isSkippedElement(parent)) this.registerTextNode(added as Text);
          }
        });
      }
    }
    this.applyAll();
  }

  // ---- localStorage persistence --------------------------------------------

  private loadCacheFromStorage(): void {
    try {
      const raw = localStorage.getItem(LS_PREFIX + this.lang);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'string') this.cache.set(k, v);
        }
      }
    } catch { /* corrupted cache — ignore */ }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (!this.cacheDirty) return;
      this.cacheDirty = false;
      try {
        let entries = Array.from(this.cache.entries());
        if (entries.length > LS_MAX_ENTRIES) entries = entries.slice(-LS_MAX_ENTRIES);
        localStorage.setItem(LS_PREFIX + this.lang, JSON.stringify(Object.fromEntries(entries)));
      } catch { /* quota exceeded — skip persisting */ }
    }, SAVE_DEBOUNCE_MS);
  }
}

let singleton: AutoTranslator | null = null;

export default function AutoTranslate() {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0];

  useEffect(() => {
    if (!singleton) singleton = new AutoTranslator();
    singleton.setLanguage(lang);
  }, [lang]);

  return null;
}
