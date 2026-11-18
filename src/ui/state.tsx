// Uygulama durumu: veritabanından canlı veri, filtreler, bildirim (toast), alt sayfa (sheet).
import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadAll } from "../db/db";
import { today } from "../lib/format";
import type { Dataset } from "../lib/types";

export interface TxFilter { q: string; period: string; kind: string; cat: string }
export const EMPTY_FILTER: TxFilter = { q: "", period: "all", kind: "all", cat: "" };

export type SheetState =
  | { kind: "tx"; id: string }
  | { kind: "picker"; which: "period" | "kind" | "cat" }
  | { kind: "restore"; data: Dataset; text: string; exported?: string }
  | { kind: "expense"; id?: string }
  | { kind: "trip"; id?: string }
  | { kind: "inflow"; id?: string }
  | { kind: "balance" }
  | { kind: "transfer" }
  | null;

/** Analiz ekranının seçimleri (ekrandan çıkıp dönünce korunur) */
export interface AnFilter { period: string | null; kind: "daily" | "trip" | "all" }

interface Ctx {
  ds: Dataset | undefined;
  todayStr: string;
  filter: TxFilter;
  setFilter: (f: TxFilter | ((f: TxFilter) => TxFilter)) => void;
  an: AnFilter;
  setAn: (f: AnFilter | ((f: AnFilter) => AnFilter)) => void;
  merchantName: string | null;
  setMerchantName: (n: string | null) => void;
  sheet: SheetState;
  setSheet: (s: SheetState) => void;
  toast: (msg: string) => void;
  toastMsg: string;
  toastOn: boolean;
}
const C = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const ds = useLiveQuery(() => loadAll(), []);
  const [filter, setFilter] = useState<TxFilter>(EMPTY_FILTER);
  const [an, setAn] = useState<AnFilter>({ period: null, kind: "daily" });
  const [merchantName, setMerchantName] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setToastMsg(m);
    setToastOn(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastOn(false), 2200);
  }, []);

  // Gün değişirse (uygulama gece açık kaldıysa) "bugün" güncellensin
  const [todayStr, setToday] = useState(today);
  useEffect(() => {
    const i = window.setInterval(() => setToday(today()), 60_000);
    return () => clearInterval(i);
  }, []);

  const value = useMemo(
    () => ({ ds, todayStr, filter, setFilter, an, setAn, merchantName, setMerchantName, sheet, setSheet, toast, toastMsg, toastOn }),
    [ds, todayStr, filter, an, merchantName, sheet, toast, toastMsg, toastOn],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useApp() {
  const c = useContext(C);
  if (!c) throw new Error("AppStateProvider eksik");
  return c;
}

/** Hash tabanlı basit yönlendirme (#ana, #hareketler …) — GitHub Pages'te sunucu ayarı gerektirmez */
export function useHashRoute() {
  const get = () => (location.hash || "#ana").slice(1);
  const [h, setH] = useState(get);
  useEffect(() => {
    const on = () => { setH(get()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return h;
}
export const go = (h: string) => { location.hash = h; };
