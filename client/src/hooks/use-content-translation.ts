import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const memoryCache = new Map<string, any>();

export function useContentTranslation<T>(content: T, cacheKey: string): {
  data: T;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0];
  const [translated, setTranslated] = useState<T>(content);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (lang === 'pt') {
      setTranslated(content);
      setIsLoading(false);
      return;
    }

    const fullKey = `${cacheKey}:${lang}`;

    if (memoryCache.has(fullKey)) {
      setTranslated(memoryCache.get(fullKey));
      setIsLoading(false);
      return;
    }

    try {
      const cached = localStorage.getItem(`ai-translate:${fullKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        memoryCache.set(fullKey, parsed);
        setTranslated(parsed);
        setIsLoading(false);
        return;
      }
    } catch {}

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, targetLang: lang, cacheKey }),
      signal: controller.signal
    })
      .then(res => {
        if (!res.ok) throw new Error('Translation request failed');
        return res.json();
      })
      .then(data => {
        if (!mountedRef.current || controller.signal.aborted) return;
        if (data.translated) {
          memoryCache.set(fullKey, data.translated);
          try {
            localStorage.setItem(`ai-translate:${fullKey}`, JSON.stringify(data.translated));
          } catch {}
          setTranslated(data.translated);
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error('Translation failed:', err);
      })
      .finally(() => {
        if (mountedRef.current && !controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [lang, cacheKey]);

  return { data: translated, isLoading };
}

export function useMultiContentTranslation(
  sections: Record<string, any>,
  pagePrefix: string
): {
  data: Record<string, any>;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0];
  const [translatedSections, setTranslatedSections] = useState(sections);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (lang === 'pt') {
      setTranslatedSections(sections);
      setIsLoading(false);
      return;
    }

    const allCached: Record<string, any> = {};
    let allFound = true;

    for (const key of Object.keys(sections)) {
      const fullKey = `${pagePrefix}-${key}:${lang}`;
      if (memoryCache.has(fullKey)) {
        allCached[key] = memoryCache.get(fullKey);
      } else {
        try {
          const cached = localStorage.getItem(`ai-translate:${fullKey}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            memoryCache.set(fullKey, parsed);
            allCached[key] = parsed;
          } else {
            allFound = false;
            break;
          }
        } catch {
          allFound = false;
          break;
        }
      }
    }

    if (allFound) {
      setTranslatedSections(allCached);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    const promises = Object.entries(sections).map(([key, content]) => {
      const fullKey = `${pagePrefix}-${key}`;
      if (memoryCache.has(`${fullKey}:${lang}`)) {
        return Promise.resolve({ key, data: memoryCache.get(`${fullKey}:${lang}`) });
      }
      return fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, targetLang: lang, cacheKey: fullKey }),
        signal: controller.signal
      })
        .then(res => res.json())
        .then(data => {
          const translated = data.translated || content;
          memoryCache.set(`${fullKey}:${lang}`, translated);
          try {
            localStorage.setItem(`ai-translate:${fullKey}:${lang}`, JSON.stringify(translated));
          } catch {}
          return { key, data: translated };
        });
    });

    Promise.all(promises)
      .then(results => {
        if (!mountedRef.current || controller.signal.aborted) return;
        const merged: Record<string, any> = {};
        results.forEach(r => { merged[r.key] = r.data; });
        setTranslatedSections(merged);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error('Multi-translation failed:', err);
      })
      .finally(() => {
        if (mountedRef.current && !controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [lang, pagePrefix]);

  return { data: translatedSections, isLoading };
}
