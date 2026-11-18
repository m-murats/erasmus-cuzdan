// Açık / koyu tema. "system" telefonun ayarını izler; seçim yalnızca bu cihazda (localStorage) saklanır.
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart as ChartJS, DoughnutController, LinearScale,
  LineController, LineElement, PointElement, Tooltip,
} from "chart.js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

ChartJS.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, LinearScale, LineController, LineElement, PointElement, Tooltip);

export type ThemeMode = "system" | "light" | "dark";
export const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];
const KEY = "erasmus-cuzdan.theme";

function initial(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY) as ThemeMode | null;
    if (v && THEME_MODES.includes(v)) return v;
  } catch { /* depolama kapalı olabilir */ }
  return "system";
}

function apply(mode: ThemeMode) {
  const r = document.documentElement;
  if (mode === "system") delete r.dataset.theme;
  else r.dataset.theme = mode;
  // Telefonun üst çubuğu (iOS/Android) temaya uysun
  const bg = getComputedStyle(r).getPropertyValue("--bg").trim();
  let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
  if (bg) m.content = bg;
}

interface Ctx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  /** Ekranda şu an görünen tema; grafikler bu değişince yeniden çizilir */
  dark: boolean;
}
const C = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => { const m = initial(); apply(m); return m; });
  const [sysDark, setSysDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => { setSysDark(mq.matches); apply(initial()); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const setMode = useCallback((m: ThemeMode) => {
    try { localStorage.setItem(KEY, m); } catch { /* yoksay */ }
    apply(m);
    setModeState(m);
  }, []);
  const dark = mode === "dark" || (mode === "system" && sysDark);
  const value = useMemo(() => ({ mode, setMode, dark }), [mode, setMode, dark]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useTheme() {
  const c = useContext(C);
  if (!c) throw new Error("ThemeProvider eksik");
  return c;
}

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/** Grafik renkleri (CSS değişkenlerinden). Tema değişince yeni değerler döner. */
export function useChartColors() {
  const { dark } = useTheme();
  return useMemo(() => {
    const c = {
      accent: css("--accent") || "#2350F5", trip: css("--trip") || "#E08A00", bad: css("--bad") || "#E5484D",
      muted: css("--muted") || "#6B7280", line: css("--line") || "#E7E9EF", surface: css("--surface") || "#fff",
      font: css("--font"), dark,
    };
    ChartJS.defaults.font.family = c.font;
    ChartJS.defaults.color = c.muted;
    ChartJS.defaults.borderColor = c.line;
    return c;
  }, [dark]);
}
