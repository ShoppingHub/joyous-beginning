import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { type Locale, type TranslationKey, getTranslation } from "@/i18n/translations";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

function detectBrowserLocale(): Locale {
  const lang = navigator.language || "";
  return lang.startsWith("it") ? "it" : "en";
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key) => getTranslation(key, "en"),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const [locale, setLocaleState] = useState<Locale>(() => {
    // Check localStorage first for instant hydration
    const saved = localStorage.getItem("betonme_locale");
    if (saved === "it" || saved === "en") return saved;
    return detectBrowserLocale();
  });

  // Load language from DB when user is available
  useEffect(() => {
    if (!user || isDemo) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("language")
        .eq("user_id", user.id)
        .single();
      if (data?.language && (data.language === "it" || data.language === "en")) {
        setLocaleState(data.language as Locale);
        localStorage.setItem("betonme_locale", data.language);
      }
    })();
  }, [user, isDemo]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("betonme_locale", newLocale);
    // Save to DB silently
    if (user && !isDemo) {
      supabase
        .from("users")
        .update({ language: newLocale } as any)
        .eq("user_id", user.id)
        .then();
    }
  }, [user, isDemo]);

  const t = useCallback((key: TranslationKey) => getTranslation(key, locale), [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
