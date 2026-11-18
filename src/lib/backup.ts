// JSON yedek: içe aktarma (prototipin v1 formatı + yeni v2) ve dışa aktarma.
// Kural: hiçbir alan kaybolmaz. Tanımadığımız alanlar da kayıtla birlikte saklanır.

import { LEGACY_ACCOUNTS } from "./constants";
import type { Account, Balance, Dataset, Expense, Inflow, Source, Transfer, Trip } from "./types";

export const FORMAT_V1 = "erasmus-cuzdan-v1";
export const FORMAT_V2 = "erasmus-cuzdan-v2";

export type BackupErrorCode = "notJson" | "notBackup" | "unknownFormat";
export class BackupError extends Error {
  constructor(public code: BackupErrorCode, public detail = "") {
    super(code + (detail ? ": " + detail : ""));
  }
}

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown) => (v === "" || v == null ? 0 : +(v as number) || 0);
const str = (v: unknown) => (v == null ? "" : String(v));

let seq = 0;
const ensureId = (x: Raw, p: string) => (x.id ? String(x.id) : p + Date.now().toString(36) + (seq++).toString(36));

function expense(x: Raw): Expense {
  return {
    ...x,
    id: ensureId(x, "e"),
    d: str(x.d),
    desc: str(x.desc),
    cat: str(x.cat) || "Diğer",
    pay: str(x.pay),
    gross: num(x.gross),
    share: num(x.share),
    cur: str(x.cur) || "PLN",
    trip: str(x.trip),
    city: str(x.city),
    note: str(x.note),
    src: (["bank", "cash", "friend", "note"].includes(str(x.src)) ? x.src : "note") as Expense["src"],
  } as Expense;
}

function balanceFromV1(x: Raw): Balance {
  const amounts: Record<string, number> = {};
  const rest: Raw = {};
  for (const [k, v] of Object.entries(x)) {
    if (LEGACY_ACCOUNTS.some((a) => a.id === k)) amounts[k] = num(v);
    else rest[k] = v;
  }
  return { ...rest, id: ensureId(x, "b"), d: str(x.d), amounts } as Balance;
}

/** Yedek dosyasının içeriğini okur ve uygulamanın veri yapısına çevirir. Hatalıysa BackupError fırlatır. */
export function parseBackup(text: string): Dataset {
  let j: Raw;
  try {
    j = JSON.parse(text);
  } catch {
    throw new BackupError("notJson");
  }
  if (!j || typeof j !== "object" || !Array.isArray(j.expenses)) {
    throw new BackupError("notBackup");
  }
  const fmt = str(j.format);
  if (fmt && fmt !== FORMAT_V1 && fmt !== FORMAT_V2) {
    throw new BackupError("unknownFormat", fmt);
  }
  // Prototipin indirdiği yedeklerde "format" alanı olmayabilir; hesap listesi yoksa v1 kabul edilir.
  const isV2 = fmt === FORMAT_V2 || Array.isArray(j.accounts);

  const accounts: Account[] = isV2
    ? arr(j.accounts).map((a, i) => ({ ...a, id: ensureId(a, "a"), bank: str(a.bank), cur: str(a.cur) || "PLN", order: num(a.order) || i + 1 }) as Account)
    : LEGACY_ACCOUNTS.map((a) => ({ ...a }));

  const balances: Balance[] = isV2
    ? arr(j.balances).map((b) => {
        const amounts: Record<string, number> = {};
        for (const [k, v] of Object.entries((b.amounts as Raw) || {})) amounts[k] = num(v);
        return { ...b, id: ensureId(b, "b"), d: str(b.d), amounts } as Balance;
      })
    : arr(j.balances).map(balanceFromV1);

  return {
    settings: (j.settings as Dataset["settings"]) || {},
    meta: (j.meta as Dataset["meta"]) || {},
    expenses: arr(j.expenses).map(expense),
    trips: arr(j.trips).map((t) => ({ ...t, id: ensureId(t, "t"), name: str(t.name), start: str(t.start), end: str(t.end), cities: Array.isArray(t.cities) ? t.cities.map(String) : [] }) as Trip),
    inflows: arr(j.inflows).map((x) => ({ ...x, id: ensureId(x, "f"), d: str(x.d), desc: str(x.desc), amount: num(x.amount), cur: str(x.cur) || "EUR", fee: num(x.fee), source: str(x.source), via: str(x.via), to: str(x.to), note: str(x.note) }) as Inflow),
    sources: arr(j.sources).map((s) => ({ ...s, id: ensureId(s, "s"), name: str(s.name), amount: num(s.amount), cur: str(s.cur) || "TL", freq: str(s.freq) }) as Source),
    accounts,
    balances,
    transfers: arr(j.transfers).map((t) => ({ ...t, id: ensureId(t, "p"), d: str(t.d), who: str(t.who), acct: str(t.acct), amount: num(t.amount), cur: str(t.cur) || "PLN", why: str(t.why), closed: !!t.closed }) as Transfer),
  };
}

/** Uygulamanın tüm verisini indirilebilir JSON metnine çevirir */
export function makeBackup(ds: Dataset, now = new Date()): string {
  return JSON.stringify(
    {
      format: FORMAT_V2,
      exported: now.toISOString(),
      settings: ds.settings,
      meta: ds.meta,
      expenses: ds.expenses,
      trips: ds.trips,
      inflows: ds.inflows,
      sources: ds.sources,
      accounts: ds.accounts,
      balances: ds.balances,
      transfers: ds.transfers,
    },
    null,
    1,
  );
}

export const backupFileName = (todayStr: string) => `erasmus-cuzdan-yedek-${todayStr}.json`;

/** Önizleme için sayılar */
export const datasetCounts = (ds: Dataset) => ({
  expenses: ds.expenses.length,
  trips: ds.trips.length,
  inflows: ds.inflows.length,
  balances: ds.balances.length,
  transfers: ds.transfers.length,
  sources: ds.sources.length,
});
