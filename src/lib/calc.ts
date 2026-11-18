// Saf hesaplama fonksiyonları. Prototipteki (reference/mevcut-uygulama.html) formüllerle birebir aynıdır.
// Hiçbiri veritabanına veya tarayıcıya dokunmaz; bu yüzden Vitest ile doğrudan test edilir.

import { DEF } from "./constants";
import { daysBetween, mKey, prevMonth } from "./format";
import type { Account, Balance, Dataset, Expense, Inflow, Settings, Trip } from "./types";

export const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

export const cfg = (ds: Pick<Dataset, "settings">): Settings => ({ ...DEF, ...(ds.settings || {}) });

/** Herhangi bir tutarı zł'ye çevirir */
export const toPLN = (c: Settings, v: number, cur: string) => (cur === "EUR" ? v * c.eurpln : cur === "TL" ? v / c.plntl : v);
/** Herhangi bir tutarı TL'ye çevirir */
export const toTL = (c: Settings, v: number, cur: string) => (cur === "EUR" ? v * c.eurtl : cur === "TL" ? v : v * c.plntl);

export const isDep = (x: Expense) => x.kind === "deposit";
/** Kullanıcının harcaması: payı (share), zł olarak. Depozito sayılmaz. */
export const mine = (c: Settings, x: Expense) => (isDep(x) ? 0 : toPLN(c, +x.share || 0, x.cur));
/** Bir para girişinin zł karşılığı: pln doluysa o, yoksa (tutar − ücret) kurdan. */
export const inPLN = (c: Settings, x: Inflow) =>
  x.pln != null && (x.pln as unknown) !== "" ? +x.pln : toPLN(c, (+x.amount || 0) - (+x.fee || 0), x.cur);

/** Analiz başlangıcından sonraki harcamalar */
export const live = (ds: Dataset) => {
  const s = cfg(ds).start;
  return ds.expenses.filter((x) => x.d >= s);
};

export const isPending = (ds: Pick<Dataset, "meta">, x: Expense) =>
  !!x.ts && !x.bankRef && (!ds.meta?.lastBankCheckAt || x.ts > ds.meta.lastBankCheckAt);

export const latestBalance = (ds: Pick<Dataset, "balances">): Balance | undefined =>
  [...ds.balances].sort((a, b) => (a.d < b.d ? 1 : -1))[0];

export const balTotal = (c: Settings, accounts: Account[], b: Balance | undefined) =>
  b ? sum(accounts, (a) => toPLN(c, +(b.amounts[a.id] ?? 0) || 0, a.cur)) : 0;

export const tripOf = (ds: Pick<Dataset, "trips">, x: Expense): Trip | undefined =>
  x.trip ? ds.trips.find((t) => t.id === x.trip) : undefined;

export function tripStats(ds: Dataset, t: Trip) {
  const c = cfg(ds);
  const xs = ds.expenses.filter((x) => x.trip === t.id);
  const tot = sum(xs, (x) => mine(c, x));
  const days = t.start && t.end ? daysBetween(t.start, t.end) + 1 : 0;
  return { xs, tot, days };
}

export function openFriends(ds: Dataset): [string, number][] {
  const c = cfg(ds), m: Record<string, number> = {};
  for (const t of ds.transfers) {
    if (t.closed) continue;
    const p = (t.who || "?").split(" (")[0];
    m[p] = (m[p] || 0) + toPLN(c, +t.amount || 0, t.cur);
  }
  return Object.entries(m).filter(([, v]) => Math.abs(v) > 0.005);
}

/**
 * Para kontrolü: gelen para − son bakiye = harcanan;
 * harcanan − kayıtlı harcamalar − depozito = açıklanamayan fark. %5'in altı "tutarlı".
 */
export function moneyCheck(ds: Dataset, todayStr: string) {
  const c = cfg(ds), b = latestBalance(ds);
  const inflows = [...ds.inflows].sort((a, x) => (a.d < x.d ? -1 : 1));
  const incoming = sum(inflows, (x) => inPLN(c, x));
  const remain = balTotal(c, ds.accounts, b);
  const spent = incoming - remain;
  const from = inflows.length ? inflows[0].d : c.start;
  const to = b ? b.d : todayStr;
  const recorded = sum(ds.expenses.filter((x) => x.d >= from && x.d <= to), (x) => mine(c, x));
  const deposit = +c.deposit || 0;
  const gap = spent - recorded - deposit;
  const gapPct = spent ? gap / spent : 0;
  return { incoming, remain, spent, from, to, recorded, deposit, gap, gapPct, ok: Math.abs(gapPct) < 0.05 };
}

/**
 * Erasmus planı:
 * gereken = (aylık bütçe − aylık sabitler) × (1 + aşma payı) × kalan ay + sabit ödemeler + gezi + alışveriş + güvenlik payı
 * kaynak = Polonya'daki para + kalan aylık gelirler + Türkiye'deki para; yatırıma ayrılabilir = kaynak − gereken
 */
export function plan(ds: Dataset, todayStr: string) {
  const c = cfg(ds), b = latestBalance(ds), fixed = c.fixed || [];
  const left = Math.max(0, daysBetween(todayStr, c.end)), months = left / 30.4;
  const fixedMonthly = sum(fixed.filter((f) => f.monthly !== false), (f) => +f.amount || 0);
  const varBudget = Math.max(0, (+c.budget || 0) - fixedMonthly);
  const over = +(c.overrun ?? 0) || 0;
  const needVar = varBudget * (1 + over / 100) * months;
  const needFixed = sum(fixed, (f) => (+f.amount || 0) * (+f.left || 0));
  const needTrip = +c.tripBudget || 0, needShop = +(c.shopBudget ?? 0) || 0;
  const buffer = ((needVar + needFixed + needTrip + needShop) * (+c.buffer || 0)) / 100;
  const need = needVar + needFixed + needTrip + needShop + buffer;
  const pl = balTotal(c, ds.accounts, b);
  const monthlyIncTL = sum(ds.sources.filter((s) => s.freq === "Aylık"), (s) => toTL(c, +s.amount || 0, s.cur));
  const inc = (monthlyIncTL * (+c.incomeLeft || 0)) / c.plntl;
  const tr = (+c.trTL || 0) / c.plntl;
  return {
    left, months, over, fixedMonthly, varBudget, needVar, needFixed, needTrip, needShop, buffer, need,
    pl, monthlyIncTL, inc, tr, fromTR: Math.max(0, need - pl - inc), invest: pl + inc + tr - need,
  };
}

/** Ana sayfadaki "bu ay" kartı */
export function monthSummary(ds: Dataset, todayStr: string) {
  const c = cfg(ds), k = mKey(todayStr);
  const list = live(ds).filter((x) => mKey(x.d) === k);
  const daily = list.filter((x) => !x.trip);
  const dSum = sum(daily, (x) => mine(c, x));
  const tSum = sum(list.filter((x) => x.trip), (x) => mine(c, x));
  const [y, m] = k.split("-").map(Number);
  const dim = new Date(y, m, 0).getDate(), dayNo = +todayStr.slice(8);
  const pct = c.budget ? dSum / c.budget : 0;
  const perDay = (c.budget - dSum) / (dim - dayNo + 1);
  const perDayVals = [...Array(dim)].map((_, i) =>
    i + 1 > dayNo ? null : sum(daily.filter((x) => +x.d.slice(8) === i + 1), (x) => mine(c, x)));
  return { k, y, m, dim, dayNo, daily, dSum, tSum, pct, perDay, perDayVals };
}

export function byMerchant(c: Settings, list: Expense[], merchantOf: (x: Expense) => string) {
  const m: Record<string, { v: number; n: number; cat: string }> = {};
  list.filter((x) => !isDep(x)).forEach((x) => {
    const k = merchantOf(x);
    m[k] = m[k] || { v: 0, n: 0, cat: x.cat };
    m[k].v += mine(c, x);
    m[k].n++;
  });
  return Object.entries(m).sort((a, b) => b[1].v - a[1].v);
}

export function monthsList(ds: Dataset, todayStr: string) {
  const ks = new Set(live(ds).map((x) => mKey(x.d)));
  ks.add(mKey(todayStr));
  return [...ks].sort();
}

// ---------- Aşama 2: Analiz, Geziler, Para ----------

export function byCat(c: Settings, list: Expense[]) {
  const m: Record<string, { v: number; n: number }> = {};
  list.filter((x) => !isDep(x)).forEach((x) => {
    m[x.cat] = m[x.cat] || { v: 0, n: 0 };
    m[x.cat].v += mine(c, x);
    m[x.cat].n++;
  });
  return Object.entries(m).sort((a, b) => b[1].v - a[1].v);
}

export type AnKind = "daily" | "trip" | "all";
const kindFilter = (kind: AnKind) => (x: Expense) => (kind === "daily" ? !x.trip : kind === "trip" ? !!x.trip : true);

/** Analiz ekranı: seçilen dönem (ay ya da "all") ve tür için tüm rakamlar */
export function analysis(ds: Dataset, period: string, kind: AnKind, todayStr: string) {
  const c = cfg(ds), lv = live(ds);
  const list = lv.filter((x) => (period === "all" || mKey(x.d) === period) && kindFilter(kind)(x));
  const tot = sum(list, (x) => mine(c, x));
  const days = period === "all"
    ? Math.max(1, daysBetween(c.start, todayStr) + 1)
    : period === mKey(todayStr) ? +todayStr.slice(8) : new Date(+period.slice(0, 4), +period.slice(5), 0).getDate();
  // Gün gün (yalnızca ay seçiliyse) ve geçen ayın aynı dönemiyle karşılaştırma
  let daily: { vals: number[]; dim: number; prevSame: number; delta: number } | null = null;
  if (period !== "all") {
    const pk = prevMonth(period);
    const pl = lv.filter((x) => mKey(x.d) === pk && kindFilter(kind)(x));
    if (pl.length) {
      const [y, mo] = period.split("-").map(Number), dim = new Date(y, mo, 0).getDate();
      const vals = [...Array(dim)].map((_, i) => sum(list.filter((x) => +x.d.slice(8) === i + 1), (x) => mine(c, x)));
      const prevSame = sum(pl.filter((x) => +x.d.slice(8) <= days), (x) => mine(c, x));
      daily = { vals, dim, prevSame, delta: tot - prevSame };
    }
  }
  // Aylara göre: günlük yaşam ve gezi ayrı
  const months = monthsList(ds, todayStr).filter((k) => lv.some((x) => mKey(x.d) === k) || k === mKey(todayStr));
  const monthly = months.map((k) => ({
    k,
    daily: sum(lv.filter((x) => mKey(x.d) === k && !x.trip), (x) => mine(c, x)),
    trip: sum(lv.filter((x) => mKey(x.d) === k && x.trip), (x) => mine(c, x)),
  }));
  return { list, tot, days, perDay: tot / days, cats: byCat(c, list), daily, monthly, budget: c.budget };
}

/** Gezideki şehirler: önce gezinin şehir sırası, sonra diğerleri */
export function tripCities(ds: Dataset, t: Trip, other: string) {
  const c = cfg(ds), m: Record<string, { v: number; n: number }> = {};
  ds.expenses.filter((x) => x.trip === t.id).forEach((x) => {
    const k = x.city || other;
    m[k] = m[k] || { v: 0, n: 0 };
    m[k].v += mine(c, x);
    m[k].n++;
  });
  const order = (t.cities || []).filter((k) => m[k]).concat(Object.keys(m).filter((k) => !(t.cities || []).includes(k)));
  return order.map((k) => [k, m[k]] as const);
}

/** Para ekranı: gelen paralar, kaynaklara göre dağılım, hibe durumu */
export function moneySummary(ds: Dataset) {
  const c = cfg(ds);
  const ins = [...ds.inflows].sort((a, b) => (a.d < b.d ? 1 : -1));
  const totPL = sum(ins, (x) => inPLN(c, x));
  const fees = sum(ins, (x) => toPLN(c, +x.fee || 0, x.cur));
  const bySrc: Record<string, number> = {};
  ins.forEach((x) => { const k = x.source || "Diğer"; bySrc[k] = (bySrc[k] || 0) + inPLN(c, x); });
  const remain = balTotal(c, ds.accounts, latestBalance(ds));
  const spent = totPL - remain;
  const grantSrc = ds.sources.find((s) => /hibe/i.test(s.name || ""));
  const gi = ins.filter((x) => x.source === "Hibe");
  const grant = grantSrc
    ? {
        total: +grantSrc.amount || 0,
        received: sum(gi, (x) => +x.amount || 0),
        net: sum(gi, (x) => (+x.amount || 0) - (+x.fee || 0)),
        note: grantSrc.note,
      }
    : null;
  return {
    ins, totPL, totEUR: totPL / c.eurpln, fees, remain, spent, usedPct: totPL ? spent / totPL : 0,
    bySrc: Object.entries(bySrc).sort((a, b) => b[1] - a[1]), grant,
  };
}

/** Gezinin banka hareketleriyle karşılaştırması (bankNetPLN girildiyse) */
export const tripBankDiff = (ds: Dataset, t: Trip) => (t.bankNetPLN ? tripStats(ds, t).tot - t.bankNetPLN : null);
