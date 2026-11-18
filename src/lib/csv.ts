// Harcamaları Excel'de açılabilen CSV'ye çevirir (prototipteki "Excel / CSV" ile aynı biçim: ; ayraç, virgüllü ondalık, BOM)
import { cfg, mine, tripOf } from "./calc";
import { merchant } from "./search";
import type { Dataset, Expense } from "./types";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const dec = (n: number) => (Math.round((+n || 0) * 100) / 100).toFixed(2).replace(".", ",");

export function expensesCsv(ds: Dataset, head: string[], srcLabel: (s: Expense["src"]) => string, catLabel: (c: string) => string = (c) => c) {
  const c = cfg(ds);
  const rows = [...ds.expenses].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)).map((x) => [
    x.d, merchant(ds, x), x.desc, catLabel(x.cat), x.pay, dec(x.gross), x.cur, dec(x.share), dec(mine(c, x)),
    tripOf(ds, x)?.name || "", x.city || "", srcLabel(x.src), x.note || "", x.ts || "",
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}
