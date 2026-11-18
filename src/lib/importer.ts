// Banka dökümü içe aktarma: satırları sınıflandırır (yeni / mükerrer / iade / transfer / atlanan) ve
// kullanıcı onayladıktan sonra veritabanına yazar. Önizleme hiçbir şeyi değiştirmez.
import { historyMap, merchantKey, suggestCat, type CatSource } from "./categorize";
import { daysBetween } from "./format";
import type { RevolutRow } from "./revolut";
import { norm } from "./search";
import type { Dataset, Expense, Transfer } from "./types";

export type ItemStatus =
  | "new"            // yeni harcama → varsayılan seçili
  | "dup"            // zaten kayıtlı (eşleşen kayıt var) → eklenmez
  | "unmatched-old"  // bankayla kontrol edilmiş dönemde ama eşleşmedi → büyük ihtimalle farklı yazılmış; varsayılan seçili değil
  | "transfer"       // arkadaş transferi adayı → varsayılan seçili değil
  | "refund"         // iade → ilgili harcamadan düşülür
  | "refund-done"    // iade zaten düşülmüş
  | "refund-nomatch" // ilgili harcama bulunamadı
  | "skip";          // atlanan (yükleme, döviz, iptal…)

export type SkipReason = "topup" | "exchange" | "reverted" | "declined" | "otherProduct" | "income" | "atm" | "unknownType" | "zero" | "reversed";

export interface ImportItem {
  ref: string;
  row: RevolutRow;
  isFee: boolean;
  status: ItemStatus;
  /** Kullanıcının seçimi (önizlemede değiştirilebilir) */
  selected: boolean;
  /** Yeni eklenecek harcama (new / unmatched-old) */
  expense?: Expense;
  catSource?: CatSource;
  /** Yeni eklenecek transfer */
  transfer?: Transfer;
  /** Eşleşen mevcut kayıt (dup) */
  match?: { id: string; table: "expenses" | "transfers"; label: string; d: string; exact: boolean; viaNote?: boolean };
  /** İadenin düşüleceği harcama */
  refundTarget?: { id: string; label: string; d: string; isNew: boolean };
  skip?: SkipReason;
  /** Bankayla zaten kontrol edilmiş döneme ait (iade için: büyük ihtimalle zaten hesaba katılmış) */
  oldPeriod?: boolean;
  /** Transfer bir gezi döneminde (gezi hesaplaşmaları genelde gezi harcamalarının payına yazılır) */
  tripName?: string;
}

export interface Preview {
  items: ImportItem[];
  from: string;
  to: string;
}

export interface PreviewOpts {
  /** Hesap adı (ödeme alanı "Revolut PLN" olur) */
  bank: string;
  /** Ücret satırının açıklaması (kullanıcının dilinde) */
  feeDesc: { exchange: string; other: string };
  /** Bu tarihe kadar banka dökümleriyle kontrol edildi (meta.bankCheckedThrough) */
  checkedThrough?: string;
}

const MATCH_DAYS = 1, REFUND_DAYS = 60;
const near = (a: string, b: string, n: number) => Math.abs(daysBetween(a, b)) <= n;
/** Kayıt tarihi (x) ile döküm satırı (r) aynı işlem olabilir mi? Konsolide dökümde tarih hesaba geçiş günüdür:
 *  işlemden önce olamaz, 1–2 gün sonra olabilir. */
const dateFits = (x: string, r: RevolutRow, similarDesc = false) => {
  const lag = daysBetween(x, r.d); // döküm − kayıt
  // Açıklama da benziyorsa daha uzun gecikme kabul edilir (ör. toplu taşıma ödemeleri bankaya 3 gün sonra geçebiliyor)
  return r.posted ? lag >= -MATCH_DAYS && lag <= (similarDesc ? 5 : 2) : Math.abs(lag) <= MATCH_DAYS;
};
/** Banka satırı hangi kayıtlarla eşleşebilir: nakit ödenenler asla; kart harcaması arkadaşın ödediği kayıtla da değil
 *  (transfer ise arkadaşın ödediği harcamanın karşılığı olabilir: "Ali ödedi, Ali'ye 23 € gönderdim") */
const isCash = (x: Expense) => x.src === "cash";
const cardOk = (x: Expense) => !isCash(x) && x.src !== "friend";
const transferOk = (x: Expense) => !isCash(x);
/** Kaydın notunda/açıklamasında bu tutar yazıyor mu ("44,10 € Booking.com + 12 € nakit" gibi birleştirilmiş kayıtlar) */
export const mentionsAmount = (text: string, a: number) => {
  const s = String(text || "").replace(/(\d)\.(\d)/g, "$1,$2");
  const v = a.toFixed(2).replace(".", ",");
  return new RegExp("(^|[^\\d,])" + v.replace(",", "\\,") + "(?![\\d])").test(s) || (v.endsWith(",00") && new RegExp("(^|[^\\d,])" + v.slice(0, -3) + "\\s*(€|zł|zl|eur|pln)", "i").test(s));
};
const same = (a: number, b: number) => Math.abs(a - b) < 0.005;
/** Açıklamalar benziyor mu: banka açıklamasındaki anlamlı kelimelerden biri kayıtta geçiyor (ya da tersi) */
export function similar(bankDesc: string, text: string) {
  const words = (s: string) => String(s || "").replace(/\d+/g, " ").split(/[^\p{L}]+/u).map(norm).filter((w) => w.length >= 3);
  const a = words(bankDesc), b = norm(text), bw = words(text), an = norm(bankDesc);
  return a.some((w) => b.includes(w)) || bw.some((w) => an.includes(w));
}

function skipReason(r: RevolutRow): SkipReason | null {
  if (r.state === "REVERTED") return "reverted";
  if (r.state === "DECLINED" || r.state === "FAILED") return "declined";
  if (r.product && !/^current$/i.test(r.product)) return "otherProduct";
  if (r.type === "TOPUP") return "topup";
  if (r.type === "EXCHANGE") return "exchange";
  if (r.type === "ATM") return "atm";
  return null;
}

export function buildPreview(ds: Dataset, rows: RevolutRow[], o: PreviewOpts): Preview {
  const hist = historyMap(ds.expenses, ds), rules = ds.rules || {};
  const items: ImportItem[] = [];
  const pay = (cur: string) => `${o.bank} ${cur}`;
  const tripOn = (d: string) => ds.trips.find((t) => t.start && t.end && d >= t.start && d <= t.end)?.id ?? "";

  const newExpense = (ref: string, r: RevolutRow, desc: string, amount: number, cat: string): Expense => ({
    id: "e" + ref, d: r.d, desc, cat, pay: pay(r.cur), gross: amount, share: amount, cur: r.cur,
    trip: tripOn(r.d), city: "", note: "", src: "bank", bankRef: ref,
  });

  for (const r of rows) {
    const skip = skipReason(r);
    // Ücretler, satırın kendisi atlansa bile (ör. döviz çevirme) ayrı "Banka & Kur Masrafı" kalemi olur — iptal edilenler hariç
    if (r.fee > 0 && skip !== "reverted" && skip !== "declined" && skip !== "otherProduct") {
      const ref = r.ref + ":fee";
      const desc = r.type === "EXCHANGE" ? o.feeDesc.exchange : `${o.feeDesc.other} (${r.desc})`;
      items.push({ ref, row: { ...r, amount: -r.fee }, isFee: true, status: "new", selected: true, expense: newExpense(ref, r, desc, r.fee, "Banka & Kur Masrafı"), catSource: "keyword" });
    }
    if (skip) { items.push({ ref: r.ref, row: r, isFee: false, status: "skip", selected: false, skip }); continue; }
    if (!r.amount) { items.push({ ref: r.ref, row: r, isFee: false, status: "skip", selected: false, skip: "zero" }); continue; }

    if (r.type === "TRANSFER") {
      const who = r.desc.replace(/^(transfer\s+(from|to)|payment\s+from|to|from)\s+/i, "").trim() || r.desc;
      items.push({
        ref: r.ref, row: r, isFee: false, status: "transfer", selected: false,
        transfer: { id: "p" + r.ref, d: r.d, who, acct: pay(r.cur), amount: r.amount, cur: r.cur, why: "", closed: false, bankRef: r.ref },
      });
      continue;
    }
    if (r.type === "REFUND" || r.type === "CARD_REFUND") {
      items.push({ ref: r.ref, row: r, isFee: false, status: "refund", selected: true });
      continue;
    }
    if (r.amount > 0) { items.push({ ref: r.ref, row: r, isFee: false, status: "skip", selected: false, skip: "income" }); continue; }
    if (r.type !== "CARD_PAYMENT" && r.type !== "FEE" && r.type !== "CHARGE") {
      // Bilinmeyen çıkış (ör. ödeme talimatı): yine de harcama olarak önerilir ama varsayılan seçilmez
      const [cat, src] = suggestCat(r.desc, rules, hist);
      items.push({ ref: r.ref, row: r, isFee: false, status: "unmatched-old", selected: false, expense: newExpense(r.ref, r, r.desc, -r.amount, cat), catSource: src, skip: "unknownType" });
      continue;
    }
    const [cat, src] = suggestCat(r.desc, rules, hist);
    items.push({ ref: r.ref, row: r, isFee: false, status: "new", selected: true, expense: newExpense(r.ref, r, r.desc, -r.amount, r.type === "FEE" ? "Banka & Kur Masrafı" : cat), catSource: src });
  }

  pairReversals(items);
  matchDuplicates(ds, items, o);
  // Gezi dönemindeki transferler (başlangıçtan 3 gün önce – bitişten 3 gün sonra)
  for (const it of items.filter((i) => i.status === "transfer")) {
    const t = ds.trips.find((x) => x.start && x.end && daysBetween(x.start, it.row.d) >= -3 && daysBetween(it.row.d, x.end) >= -3);
    if (t) it.tripName = t.name;
  }
  matchRefunds(ds, items, o.checkedThrough);
  const ds2 = items.filter((i) => i.status !== "skip").map((i) => i.row.d).sort();
  return { items, from: ds2[0] ?? "", to: ds2[ds2.length - 1] ?? "" };
}

/** Aynı dosyada birbirini sıfırlayan çekim + iade (ör. kart doğrulama için 1 zł çekilip ertesi gün iade) → ikisi de atlanır */
function pairReversals(items: ImportItem[]) {
  for (const rf of items.filter((i) => i.status === "refund")) {
    const ch = items.find((i) => i.status === "new" && !i.isFee && i.row.cur === rf.row.cur && same(-i.row.amount, rf.row.amount)
      && near(i.row.d, rf.row.d, 7) && similar(rf.row.desc, i.row.desc));
    if (!ch) continue;
    for (const i of [ch, rf]) { i.status = "skip"; i.selected = false; i.skip = "reversed"; delete i.expense; }
  }
}

/** Mükerrer tespiti: aynı banka kimliği; ya da ±1 gün, aynı tutar ve para birimi (+ benzer açıklama daha güçlü eşleşme).
 *  Her mevcut kayıt en fazla bir satırla eşleşir. */
function matchDuplicates(ds: Dataset, items: ImportItem[], o: PreviewOpts) {
  const used = new Set<string>();
  const exps = items.filter((i) => i.expense && (i.status === "new" || i.status === "unmatched-old"));
  const label = (x: Expense) => x.desc;

  // 1) Aynı banka kimliği (dosya daha önce içe aktarıldıysa)
  for (const it of exps) {
    const m = ds.expenses.find((x) => x.bankRef === it.ref && !used.has(x.id));
    if (m) setDup(it, m.id, "expenses", label(m), m.d, true);
  }
  // 2) Tutar + tarih (+ açıklama). Önce açıklaması benzeyenler, sonra yalnızca tutar-tarih tutanlar; en yakın gün önce.
  for (const pass of [true, false]) {
    for (const it of exps) {
      if (it.status === "dup") continue;
      const r = it.row, amount = -r.amount;
      const cands = ds.expenses.filter((x) => !used.has(x.id) && !x.bankRef && cardOk(x) && x.cur === r.cur && same(+x.gross || 0, amount)
        && (pass ? similar(r.desc, x.desc + " " + x.note) && dateFits(x.d, r, true) : dateFits(x.d, r)));
      if (!cands.length) continue;
      cands.sort((a, b) => Math.abs(daysBetween(a.d, r.d)) - Math.abs(daysBetween(b.d, r.d)) || (a.pay.startsWith(o.bank) ? -1 : 1));
      setDup(it, cands[0].id, "expenses", label(cands[0]), cands[0].d, pass);
    }
  }
  // 3) Birleştirilmiş kayıtlar: notunda bu banka tutarı yazan, açıklaması benzeyen, en fazla 3 gün uzaktaki kayıt
  for (const it of exps) {
    if (it.status === "dup") continue;
    const r = it.row, amount = -r.amount;
    const m = ds.expenses.find((x) => !used.has(x.id) && !x.bankRef && cardOk(x) && Math.abs(daysBetween(x.d, r.d)) <= 3
      && similar(r.desc, x.desc + " " + x.note) && mentionsAmount(x.note + " " + x.desc, amount));
    if (m) { setDup(it, m.id, "expenses", label(m), m.d, false); it.match!.viaNote = true; }
  }
  // 4) Transferler: banka kimliği ya da ±1 gün, aynı işaretli tutar ve para birimi
  for (const it of items.filter((i) => i.status === "transfer")) {
    const r = it.row;
    const m = ds.transfers.find((x) => !used.has(x.id) && (x.bankRef === it.ref || (!x.bankRef && x.cur === r.cur && same(+x.amount, r.amount) && dateFits(x.d, r))));
    if (m) { setDup(it, m.id, "transfers", m.who + (m.why ? " · " + m.why : ""), m.d, m.bankRef === it.ref); continue; }
    // Arkadaşa değil de bir harcamaya giden para (ör. kira, BLIK ile ödeme) zaten harcama olarak girilmiş olabilir
    if (r.amount < 0) {
      const e = ds.expenses.find((x) => !used.has(x.id) && (x.bankRef === it.ref || (!x.bankRef && transferOk(x) && x.cur === r.cur && same(+x.gross || 0, -r.amount) && dateFits(x.d, r))));
      if (e) setDup(it, e.id, "expenses", label(e), e.d, e.bankRef === it.ref);
    }
  }
  // Eşleşmeyen ama bankayla zaten kontrol edilmiş dönemdeki harcamalar: büyük ihtimalle başka biçimde kayıtlı
  if (o.checkedThrough)
    for (const it of exps) if (it.status === "new" && it.row.d <= o.checkedThrough!) { it.status = "unmatched-old"; it.selected = false; }

  function setDup(it: ImportItem, id: string, table: "expenses" | "transfers", lbl: string, d: string, exact: boolean) {
    used.add(id);
    it.status = "dup";
    it.selected = false;
    it.match = { id, table, label: lbl, d, exact };
  }
}

/** İadeler: aynı satıcıdan, aynı para biriminde, ±60 gün içindeki en yakın harcama (mevcut ya da bu dosyadaki yeni) */
function matchRefunds(ds: Dataset, items: ImportItem[], checkedThrough?: string) {
  for (const it of items.filter((i) => i.status === "refund")) {
    const r = it.row, amt = r.amount, key = merchantKey(r.desc);
    const done = ds.expenses.find((x) => (x.refundRefs || []).includes(it.ref));
    if (done) { it.status = "refund-done"; it.selected = false; it.refundTarget = { id: done.id, label: done.desc, d: done.d, isNew: false }; continue; }
    type C = { id: string; desc: string; d: string; isNew: boolean; note: string };
    const pool: C[] = [
      ...ds.expenses.filter((x) => x.cur === r.cur && (+x.gross || 0) + 0.005 >= amt).map((x) => ({ id: x.id, desc: x.desc, d: x.d, isNew: false, note: x.note })),
      ...items.filter((i) => i.expense && i.status === "new" && i.row.cur === r.cur && i.expense.gross + 0.005 >= amt)
        .map((i) => ({ id: i.expense!.id, desc: i.expense!.desc, d: i.expense!.d, isNew: true, note: "" })),
    ].filter((c) => near(c.d, r.d, REFUND_DAYS) && (merchantKey(c.desc).startsWith(key) || key.startsWith(merchantKey(c.desc)) || similar(r.desc, c.desc)));
    pool.sort((a, b) => Math.abs(daysBetween(a.d, r.d)) - Math.abs(daysBetween(b.d, r.d)));
    const t = pool[0];
    if (!t) { it.status = "refund-nomatch"; it.selected = false; continue; }
    it.refundTarget = { id: t.id, label: t.desc, d: t.d, isNew: t.isNew };
    // Not alanında "iade" geçiyorsa kullanıcı muhtemelen elle düşmüştür → varsayılan seçilmez
    if (/iade|refund|zwrot/i.test(t.note)) it.selected = false;
    // Kontrol edilmiş dönemdeki iade büyük ihtimalle zaten hesaba katıldı → iki kez düşmemek için varsayılan seçilmez
    if (checkedThrough && r.d <= checkedThrough) { it.selected = false; it.oldPeriod = true; }
  }
}

export interface ImportPlan {
  expenses: Expense[];
  transfers: Transfer[];
  /** Mevcut harcamalara yapılacak değişiklikler (iade düşme, banka kimliği ekleme) */
  updates: Expense[];
  transferUpdates: Transfer[];
  rules: Record<string, string>;
}

/** Seçimlere göre veritabanına yazılacakları hesaplar (saf fonksiyon; yazma işlemini db.applyImport yapar) */
export function planImport(ds: Dataset, items: ImportItem[], refundNote: (amount: number, cur: string, d: string) => string, originalCats: Record<string, string> = {}): ImportPlan {
  const newExp = new Map<string, Expense>();
  for (const it of items) if (it.selected && it.expense && (it.status === "new" || it.status === "unmatched-old")) newExp.set(it.expense.id, { ...it.expense });
  const updates = new Map<string, Expense>();
  const get = (id: string) => newExp.get(id) ?? updates.get(id) ?? (() => { const x = ds.expenses.find((e) => e.id === id); if (x) { const c = { ...x }; updates.set(id, c); return c; } return undefined; })();

  for (const it of items) {
    if (!it.selected || it.status !== "refund" || !it.refundTarget) continue;
    const x = get(it.refundTarget.id);
    if (!x) continue; // hedef yeni bir satırdı ama seçilmedi
    const g = +x.gross || 0, s = +x.share || 0, a = it.row.amount;
    x.share = Math.round((s - (g ? (a * s) / g : a)) * 100) / 100;
    x.gross = Math.round((g - a) * 100) / 100;
    x.refundRefs = [...(x.refundRefs || []), it.ref];
    x.note = [x.note, refundNote(a, it.row.cur, it.row.d)].filter(Boolean).join(" · ");
  }
  // Eşleşen mevcut kayıtlara banka kimliği eklenir (bir dahaki içe aktarmada kesin tanınır; "kontrol bekliyor" kalkar)
  const transferUpdates: Transfer[] = [];
  for (const it of items) {
    if (it.status !== "dup" || !it.match) continue;
    if (it.match.table === "expenses") {
      if (ds.expenses.find((e) => e.id === it.match!.id)?.bankRef) continue;
      const x = get(it.match.id);
      if (x && !x.bankRef) x.bankRef = it.ref;
    } else {
      const t = ds.transfers.find((x) => x.id === it.match!.id);
      if (t && !t.bankRef) transferUpdates.push({ ...t, bankRef: it.ref });
    }
  }
  // Kullanıcının önizlemede değiştirdiği kategoriler kural olarak kaydedilir
  const rules: Record<string, string> = {};
  for (const it of items) {
    if (!it.selected || !it.expense || it.isFee) continue;
    const before = originalCats[it.ref];
    if (before && before !== it.expense.cat) { const k = merchantKey(it.row.desc); if (k) rules[k] = it.expense.cat; }
  }
  return { expenses: [...newExp.values()], transfers: items.filter((i) => i.selected && i.status === "transfer" && i.transfer).map((i) => i.transfer!), updates: [...updates.values()], transferUpdates, rules };
}

export const countBy = (items: ImportItem[]) => {
  const c: Record<ItemStatus, number> = { new: 0, dup: 0, "unmatched-old": 0, transfer: 0, refund: 0, "refund-done": 0, "refund-nomatch": 0, skip: 0 };
  for (const i of items) c[i.status]++;
  return c;
};
