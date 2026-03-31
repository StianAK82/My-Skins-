import { create } from "zustand";
import { translations, Language, TranslationKey } from "../i18n";
import { useGetMe } from "@workspace/api-client-react";
import { useEffect } from "react";

type LanguageStore = {
  language: Language;
  setLanguage: (lang: Language) => void;
};

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: (localStorage.getItem("preferredLanguage") as Language) || "en",
  setLanguage: (lang) => {
    localStorage.setItem("preferredLanguage", lang);
    set({ language: lang });
  },
}));

export function useLanguage() {
  const { language, setLanguage } = useLanguageStore();
  const { data: user } = useGetMe({ query: { retry: false } });

  useEffect(() => {
    if (user?.language && ["en", "no", "es"].includes(user.language)) {
      setLanguage(user.language as Language);
    }
  }, [user?.language, setLanguage]);

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return { t, language, setLanguage };
}
