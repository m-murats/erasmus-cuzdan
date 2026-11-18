// Revolut hesap dökümü (uygulama → Statement → Excel/CSV) okuyucu.
// Sütunlar: Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance
// Kural (CLAUDE.md): tarih olarak Started Date kullanılır; Completed Date kart harcamalarını çoğu zaman 1 gün sonra gösterir.
import Papa from "papaparse";

export interface RevolutRow {
  /** Dosyadaki satır numarası (başlık = 1) */
  line: number;
  type: string;
  product: string;
  /** İşlemin yapıldığı gün (Started Date), YYYY-MM-DD */
  d: string;
  started: string;
  desc: string;
  /** İşaretli tutar: − çıkan, + giren */
  amount: number;
  /** Ücret (pozitif) */
  fee: number;
  cur: string;
  state: string;
  /** Satırın kalıcı kimliği: aynı dosya ikinci kez yüklenince tanınır */
  ref: string;
  /** Tarih işlemin değil hesaba geçişin tarihi (konsolide döküm): kart harcamalarında genelde 1 gün sonra */
  posted?: boolean;
}

export class StatementError extends Error {
  constructor(public code: "empty" | "columns", public detail = "") {
    super(code + (detail ? ": " + detail : ""));
  }
}

const REQUIRED = ["Type", "Started Date", "Description", "Amount", "Currency", "State"];

/** "1,234.56" / "1234,56" / "-25.33" → sayı */
export function parseAmount(v: unknown): number {
  let s = String(v ?? "").replace(/[\s ]/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = +s;
  return Number.isFinite(n) ? n : 0;
}

/** Kısa, kararlı kimlik (FNV-1a) */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

export function parseRevolutCsv(text: string): RevolutRow[] {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  const fields = res.meta.fields || [];
  const missing = REQUIRED.filter((c) => !fields.includes(c));
  if (missing.length) throw new StatementError("columns", missing.join(", "));
  if (!res.data.length) throw new StatementError("empty");
  return res.data.map((r, i) => {
    const started = (r["Started Date"] || "").trim();
    const amount = parseAmount(r["Amount"]), cur = (r["Currency"] || "").trim().toUpperCase();
    const desc = (r["Description"] || "").trim(), type = (r["Type"] || "").trim().toUpperCase();
    return {
      line: i + 2, type, product: (r["Product"] || "").trim(), d: started.slice(0, 10), started, desc,
      amount, fee: Math.abs(parseAmount(r["Fee"])), cur, state: (r["State"] || "").trim().toUpperCase(),
      ref: "rv-" + started.slice(0, 10) + "-" + hash([type, started, desc, amount.toFixed(2), cur].join("|")),
    };
  });
}

// ---------- Revolut konsolide dökümü (consolidated_statement_*.csv) ----------
// Hesap başına bölümler ("Personal Account (PLN)" → "Transaction statement" → Date,Description,Category,"Money in/out",…).
// Started Date YOK: "Date" hesaba geçiş tarihidir ve kart harcamalarında çoğu zaman 1 gün sonradır (bkz. CLAUDE.md).
// Type/State yerine Category vardır: Merchant, Others, Exchange, Top up, Refund.

const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "Oct 9, 2026" → "2026-10-09" */
export function parseEnDate(s: string) {
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(String(s || "").trim());
  if (!m) return "";
  const mo = MONTHS_EN.indexOf(m[1].toLowerCase());
  return mo < 0 ? "" : `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
/** "-€14.99", "1,102.17 PLN", "€0.00" → sayı */
const money = (s: string) => parseAmount(String(s || "").replace(/[€$£]|[A-Z]{3}/g, ""));

export const isConsolidated = (text: string) => /Transaction statement/.test(text) && /Money in\/out/.test(text);

export function parseConsolidatedCsv(text: string): RevolutRow[] {
  const lines = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false }).data;
  const out: RevolutRow[] = [];
  let account = "", cur = "", head: string[] | null = null;
  lines.forEach((r, i) => {
    const c0 = (r[0] || "").trim();
    const acc = /^(.+?)\s*\(([A-Z]{3})\)$/.exec(c0);
    if (acc && r.slice(1).every((x) => !x)) { account = acc[1]; cur = acc[2]; head = null; return; }
    if (c0 === "Date" && r.includes("Description")) { head = r.map((x) => x.trim()); return; }
    if (!head) return;
    if (c0.startsWith("---") || c0 === "Total") { head = null; return; }
    const d = parseEnDate(c0);
    if (!d) return;
    const col = (name: string) => r[head!.indexOf(name)] ?? ""; // aynı adlı sütunların ilki hesabın kendi para birimi
    const desc = col("Description").trim(), category = col("Category").trim(), balance = col("Balance");
    const amount = money(col("Money in/out")), fee = Math.abs(money(col("Fees")));
    let type: string;
    if (category === "Exchange") type = "EXCHANGE";
    else if (category === "Top up") type = "TOPUP";
    else if (category === "Refund") type = "REFUND";
    else if (/^(transfer (from|to)|payment (from|to))\s/i.test(desc)) type = "TRANSFER";
    else type = "CARD_PAYMENT"; // Merchant ve "Others" altındaki kart ödemeleri (ör. Uber); girişler aşağıda "gelen para" olarak atlanır
    out.push({
      line: i + 1, type, product: /personal|current/i.test(account) ? "Current" : account, d, started: d, desc, amount, fee, cur,
      state: "COMPLETED", posted: true,
      ref: "rc-" + d + "-" + hash([cur, d, desc, amount.toFixed(2), balance].join("|")),
    });
  });
  if (!out.length) throw new StatementError("empty");
  return out;
}

/** Dosya biçimini kendisi tanır: normal Revolut CSV'si ya da konsolide döküm */
export const parseStatement = (text: string) => (isConsolidated(text) ? parseConsolidatedCsv(text) : parseRevolutCsv(text));
