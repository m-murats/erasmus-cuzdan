// Arama ve mağaza adı çıkarma — prototipteki norm / merchant / matches ile aynı.

import { tripOf } from "./calc";
import type { Dataset, Expense } from "./types";

export const norm = (s: string | undefined) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "");

/** Açıklamadan mağaza/yer adını çıkarır ("Roma – McDonald's (2 kişi)" → "McDonald's") */
export function merchant(ds: Pick<Dataset, "trips">, x: Expense) {
  const parts = String(x.desc || "").split(" – ");
  const t = tripOf(ds, x);
  let d = parts[0];
  if (parts.length > 1 && t && (t.cities || []).includes(parts[0])) d = parts.slice(1).join(" – ");
  d = d.replace(/\s*\(.*?\)\s*/g, " ").trim();
  if (d.includes("→")) d = d.split(" ")[0];
  return d.charAt(0).toLocaleUpperCase("tr") + d.slice(1);
}

function hay(ds: Pick<Dataset, "trips">, x: Expense) {
  const t = tripOf(ds, x);
  return norm([x.desc, x.note, x.cat, x.city, x.pay, t && t.name, merchant(ds, x)].join(" "));
}

/** Her kelime eşleşmeli; sayı yazılırsa tutarla da eşleşir ("26" → 26,00 zł) */
export function matches(ds: Pick<Dataset, "trips">, x: Expense, q: string) {
  if (!q.trim()) return true;
  const toks = q.split(/\s+/).filter(Boolean), h = hay(ds, x);
  return toks.every((tk) => {
    const n = tk.replace(",", ".");
    if (/^\d+([.]\d+)?$/.test(n)) {
      const v = +n;
      return Math.abs((+x.share || 0) - v) < 0.01 || Math.abs((+x.gross || 0) - v) < 0.01 || h.includes(norm(tk));
    }
    return h.includes(norm(tk));
  });
}
