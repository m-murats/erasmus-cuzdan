import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { setFormatLang } from "../lib/format";
import { DICT, LANGS, type Dict, type Lang } from "./dict";

const KEY = "erasmus-cuzdan.lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGS.includes(saved)) return saved;
  } catch { /* depolama kapalı olabilir */ }
  // Kayıtlı tercih yoksa telefonun diline bak: Türkçe değilse İngilizce
  return (navigator.language || "").toLowerCase().startsWith("tr") ? "tr" : "en";
}

interface Ctx {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
  /** Kategori adını ekranda gösterilecek dile çevirir */
  cat: (c: string) => string;
  /** Veride Türkçe saklanan bir değeri (ödeme yöntemi, kaynak…) ekranda gösterilecek dile çevirir */
  val: (v: string) => string;
}
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = initialLang();
    setFormatLang(l);
    return l;
  });
  const setLang = useCallback((l: Lang) => {
    setFormatLang(l);
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* yoksay */ }
    document.documentElement.lang = l;
  }, []);
  const value = useMemo<Ctx>(() => {
    const t = DICT[lang];
    document.documentElement.lang = lang;
    document.title = t.appTitle;
    return { lang, t, setLang, cat: (c) => t.cats[c] || c, val: (v) => t.vals[v] || v };
  }, [lang, setLang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("I18nProvider eksik");
  return c;
}
