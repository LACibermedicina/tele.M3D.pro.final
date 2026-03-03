import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { TranslationLoading } from './translation-loading';

const pageTranslationCache = new Map<string, Map<string, string>>();

const MIN_TEXT_LENGTH = 2;
const MAX_BATCH_SIZE = 150;
const DEBOUNCE_MS = 800;

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'CODE', 'PRE', 'SVG', 'PATH', 'CIRCLE', 'RECT',
  'LINE', 'POLYGON', 'POLYLINE', 'ELLIPSE', 'G', 'DEFS', 'USE',
  'CLIPPATH', 'MASK', 'PATTERN', 'LINEARGRADIENT', 'RADIALGRADIENT',
  'STOP', 'FEBLEND', 'FEGAUSSIANBLUR', 'NOSCRIPT', 'IFRAME', 'CANVAS',
  'VIDEO', 'AUDIO', 'SOURCE', 'TRACK', 'TEXTAREA', 'INPUT', 'SELECT',
]);

const SKIP_CLASSES = ['lucide', 'fa-', 'icon', 'agora-', 'sr-only'];

const originalTextMap = new WeakMap<Text, string>();
const originalPlaceholderMap = new WeakMap<HTMLElement, string>();

function shouldSkipNode(node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.getAttribute('data-no-translate') !== null) return true;
    if (el.getAttribute('translate') === 'no') return true;
    if (el.getAttribute('role') === 'img') return true;
    const cls = el.className;
    if (typeof cls === 'string' && SKIP_CLASSES.some(c => cls.includes(c))) return true;
  }
  return false;
}

function isNumericOrSymbol(text: string): boolean {
  return /^[\d\s\-+.,/:;%$€£¥₹#@&*()[\]{}|<>=!?'"\\`~^_×÷•·…]+$/.test(text);
}

function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent || node.textContent.trim().length < MIN_TEXT_LENGTH) {
        return NodeFilter.FILTER_REJECT;
      }
      if (isNumericOrSymbol(node.textContent.trim())) {
        return NodeFilter.FILTER_REJECT;
      }
      let parent = node.parentElement;
      while (parent && parent !== root) {
        if (shouldSkipNode(parent)) return NodeFilter.FILTER_REJECT;
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  return nodes;
}

function collectPlaceholders(root: HTMLElement): HTMLElement[] {
  const inputs = root.querySelectorAll<HTMLElement>('input[placeholder], textarea[placeholder]');
  return Array.from(inputs).filter(el => {
    const ph = el.getAttribute('placeholder') || '';
    return ph.trim().length >= MIN_TEXT_LENGTH && !isNumericOrSymbol(ph.trim());
  });
}

function getPageKey(pathname: string): string {
  return pathname.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'home';
}

function loadCacheFromStorage(cacheKey: string): Map<string, string> {
  const cache = new Map<string, string>();
  try {
    const stored = localStorage.getItem(`auto-translate:${cacheKey}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([k, v]) => cache.set(k, v as string));
    }
  } catch {}
  return cache;
}

function saveCacheToStorage(cacheKey: string, cache: Map<string, string>) {
  try {
    const obj: Record<string, string> = {};
    cache.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(`auto-translate:${cacheKey}`, JSON.stringify(obj));
  } catch {}
}

export function AutoTranslateWrapper({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0];
  const [location] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runTokenRef = useRef(0);

  const restoreOriginals = useCallback(() => {
    if (!containerRef.current) return;
    const textNodes = collectTextNodes(containerRef.current);
    for (const node of textNodes) {
      const original = originalTextMap.get(node);
      if (original) {
        node.textContent = original;
        originalTextMap.delete(node);
      }
    }
    const placeholders = collectPlaceholders(containerRef.current);
    for (const el of placeholders) {
      const original = originalPlaceholderMap.get(el);
      if (original) {
        el.setAttribute('placeholder', original);
        originalPlaceholderMap.delete(el);
      }
    }
  }, []);

  const translatePage = useCallback(async () => {
    if (!containerRef.current || lang === 'pt') return;

    const currentToken = ++runTokenRef.current;
    const pageKey = getPageKey(location);
    const cacheKey = `${pageKey}:${lang}`;

    let cache = pageTranslationCache.get(cacheKey);
    if (!cache) {
      cache = loadCacheFromStorage(cacheKey);
      pageTranslationCache.set(cacheKey, cache);
    }

    const textNodes = collectTextNodes(containerRef.current);
    const placeholderEls = collectPlaceholders(containerRef.current);

    for (const node of textNodes) {
      if (!originalTextMap.has(node)) {
        originalTextMap.set(node, node.textContent || '');
      }
    }
    for (const el of placeholderEls) {
      if (!originalPlaceholderMap.has(el)) {
        originalPlaceholderMap.set(el, el.getAttribute('placeholder') || '');
      }
    }

    const uncachedTexts: string[] = [];
    const uncachedSet = new Set<string>();

    for (const node of textNodes) {
      const original = originalTextMap.get(node) || node.textContent || '';
      const text = original.trim();
      if (text && !cache.has(text) && !uncachedSet.has(text)) {
        uncachedTexts.push(text);
        uncachedSet.add(text);
      }
    }
    for (const el of placeholderEls) {
      const original = originalPlaceholderMap.get(el) || el.getAttribute('placeholder') || '';
      const ph = original.trim();
      if (ph && !cache.has(ph) && !uncachedSet.has(ph)) {
        uncachedTexts.push(ph);
        uncachedSet.add(ph);
      }
    }

    if (uncachedTexts.length > 0) {
      setIsLoading(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const batches: string[][] = [];
        for (let i = 0; i < uncachedTexts.length; i += MAX_BATCH_SIZE) {
          batches.push(uncachedTexts.slice(i, i + MAX_BATCH_SIZE));
        }

        for (const batch of batches) {
          if (controller.signal.aborted || runTokenRef.current !== currentToken) break;

          const res = await fetch('/api/ai/translate-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: batch, targetLang: lang, pageKey }),
            signal: controller.signal
          });

          if (!res.ok) throw new Error('Batch translation failed');

          const data = await res.json();
          if (data.translations && typeof data.translations === 'object') {
            for (const [original, translated] of Object.entries(data.translations)) {
              if (typeof translated === 'string' && translated.length > 0) {
                cache!.set(original, translated);
              }
            }
          }
        }

        saveCacheToStorage(cacheKey, cache!);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Auto-translate failed:', err);
        }
      }
    }

    if (runTokenRef.current !== currentToken) return;

    for (const node of textNodes) {
      const original = originalTextMap.get(node) || '';
      const text = original.trim();
      const translated = cache.get(text);
      if (translated && translated !== text) {
        const whiteBefore = original.match(/^\s*/)?.[0] || '';
        const whiteAfter = original.match(/\s*$/)?.[0] || '';
        node.textContent = whiteBefore + translated + whiteAfter;
      }
    }

    for (const el of placeholderEls) {
      const original = originalPlaceholderMap.get(el) || '';
      const ph = original.trim();
      const translated = cache.get(ph);
      if (translated && translated !== ph) {
        el.setAttribute('placeholder', translated);
      }
    }

    setIsLoading(false);
  }, [lang, location]);

  useEffect(() => {
    if (lang === 'pt') {
      abortRef.current?.abort();
      setIsLoading(false);
      restoreOriginals();
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      translatePage();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lang, location, translatePage, restoreOriginals]);

  useEffect(() => {
    if (lang === 'pt' || !containerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      let hasNewContent = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent?.trim();
              if (text && text.length >= MIN_TEXT_LENGTH && !isNumericOrSymbol(text)) {
                hasNewContent = true;
                break;
              }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (!shouldSkipNode(el) && el.textContent?.trim()) {
                hasNewContent = true;
                break;
              }
            }
          }
        } else if (mutation.type === 'characterData') {
          const text = mutation.target.textContent?.trim();
          if (text && text.length >= MIN_TEXT_LENGTH && !originalTextMap.has(mutation.target as Text)) {
            hasNewContent = true;
          }
        }
        if (hasNewContent) break;
      }

      if (hasNewContent) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          translatePage();
        }, DEBOUNCE_MS * 1.5);
      }
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [lang, translatePage]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <TranslationLoading isLoading={isLoading}>
      <div ref={containerRef} data-auto-translate="true">
        {children}
      </div>
    </TranslationLoading>
  );
}
