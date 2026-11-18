// Tarih ve para biçimlendirme. Dil (tr/en) setFormatLang ile değiştirilir; ay/gün adları sözlükten gelir.

import { DICT, type Lang } from "../i18n/dict";

let lang: Lang = "tr";
let nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export function setFormatLang(l: Lang) {
  lang = l;
  const loc = l === "en" ? "en-GB" : "tr-TR";
  nf2 = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
}
const MONTHS = () => DICT[lang].months;
const DAYS = () => DICT[lang].days;

export const n2 = (n: number) => nf2.format(n || 0);
export const n0 = (n: number) => nf0.format(Math.round(n || 0));
export const zl = (n: number) => n2(n) + " zł";
export const zl0 = (n: number) => n0(n) + " zł";
export const tl = (n: number) => n0(n) + " ₺";
export const eu = (n: number) => n2(n) + " €";
export const amt = (n: number, c: string) => (c === "EUR" ? eu(n) : c === "TL" ? tl(n) : zl(n));

export const mKey = (d: string) => d.slice(0, 7);
export const monthName = (m: number) => MONTHS()[m - 1];
export const mName = (k: string) => {
  const [y, m] = k.split("-");
  return MONTHS()[+m - 1] + " " + y;
};
export const parseD = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const isoDay = (t: Date) =>
  t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
export const today = () => isoDay(new Date());
export const daysBetween = (a: string, b: string) => Math.round((parseD(b).getTime() - parseD(a).getTime()) / 864e5);
export const dShort = (s: string) => {
  const d = parseD(s);
  return d.getDate() + " " + MONTHS()[d.getMonth()].slice(0, 3);
};
export const dayName = (s: string) => DAYS()[parseD(s).getDay()];
export const prevMonth = (k: string) => {
  let [y, m] = k.split("-").map(Number);
  m--;
  if (!m) { m = 12; y--; }
  return y + "-" + String(m).padStart(2, "0");
};
export function fmtTs(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.getDate() + " " + MONTHS()[d.getMonth()].slice(0, 3) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
