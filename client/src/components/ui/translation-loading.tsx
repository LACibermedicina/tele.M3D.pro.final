import { Loader2, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

const loadingLabels: Record<string, string> = {
  pt: "Traduzindo...",
  en: "Translating...",
  es: "Traduciendo...",
  fr: "Traduction...",
  de: "Übersetzen...",
  it: "Traduzione...",
  ja: "翻訳中...",
  zh: "翻译中...",
  gn: "Oñembohasa..."
};

interface TranslationLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
}

export function TranslationLoading({ isLoading, children }: TranslationLoadingProps) {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0];
  const label = loadingLabels[lang] || loadingLabels.en;

  return (
    <div className="relative">
      {isLoading && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium animate-pulse">
          <Globe className="w-4 h-4" />
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{label}</span>
        </div>
      )}
      <div className={isLoading ? "opacity-60 transition-opacity duration-300" : "transition-opacity duration-300"}>
        {children}
      </div>
    </div>
  );
}
