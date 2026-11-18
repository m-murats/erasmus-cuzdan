// Revolut CSV içe aktarma. Yalnızca uydurma veriler: fixtures/revolut-ornek.csv + fixtures/ornek-yedek.json
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WalletDB, applyImport, loadAll, replaceAll } from "../db/db";
import { parseBackup } from "./backup";
import { suggestCat } from "./categorize";
import { buildPreview, countBy, planImport, similar, type ImportItem } from "./importer";
import { StatementError, parseAmount, parseRevolutCsv } from "./revolut";
import type { Dataset, Expense } from "./types";

const csv = readFileSync(new URL("../../fixtures/revolut-ornek.csv", import.meta.url), "utf8");
const base = parseBackup(readFileSync(new URL("../../fixtures/ornek-yedek.json", import.meta.url), "utf8"));
const OPTS = { bank: "Revolut", feeDesc: { exchange: "Revolut – kur çevirme ücreti", other: "Revolut – ücret" } };

const exp = (p: Partial<Expense> & { id: string; d: string; desc: string; gross: number }): Expense => ({
  cat: "Diğer", pay: "Revolut PLN", share: p.gross, cur: "PLN", trip: "", city: "", note: "", src: "bank", ...p,
});
/** Örnek CSV'nin bir kısmı elle girilmiş gibi bir veri kümesi */
function withManual(): Dataset {
  return {
    ...base,
    meta: { ...base.meta, bankCheckedThrough: "2026-10-09" },
    trips: [...base.trips, { id: "it", name: "İtalya", start: "2026-11-09", end: "2026-11-14", cities: ["Roma"] }],
    expenses: [
      ...base.expenses,
      exp({ id: "m1", d: "2026-10-08", desc: "Biedronka", cat: "Market", gross: 25.33 }),
      exp({ id: "m2", d: "2026-10-08", desc: "Pijalnie Czekolady – mentor ile tatlı", cat: "Yeme-İçme (dışarıda)", gross: 27.5 }),
      exp({ id: "m3", d: "2026-10-10", desc: "Revolut – kur çevirme ücreti", cat: "Banka & Kur Masrafı", gross: 8.74 }),
      // Ortak ödeme: kart toplamı çekti (gross), kullanıcının payı yarısı
      exp({ id: "m4", d: "2026-11-09", desc: "Roma – McDonald's (2 kişi)", cat: "Yeme-İçme (dışarıda)", gross: 6.19, share: 3.1, cur: "EUR", pay: "Revolut EUR", trip: "it" }),
      exp({ id: "m5", d: "2026-10-07", desc: "Amazon – yatak örtüsü", cat: "Ev & Mutfak", gross: 618.34 }),
    ],
    transfers: [...base.transfers, { id: "t9", d: "2026-11-10", who: "Örnek", acct: "Revolut EUR", amount: 14, cur: "EUR", why: "hostel", closed: true }],
  };
}
const byDesc = (items: ImportItem[], s: string) => items.filter((i) => i.row.desc.includes(s));

describe("Revolut CSV okuma", () => {
  const rows = parseRevolutCsv(csv);
  it("tüm satırlar okunur; tarih Started Date'ten gelir", () => {
    expect(rows).toHaveLength(13);
    const b = rows.find((r) => r.desc === "Biedronka" && r.state === "COMPLETED")!;
    expect(b.d).toBe("2026-10-08"); // Completed Date 9 Ekim; esas alınan 8 Ekim
    expect(b.amount).toBe(-25.33);
    expect(b.cur).toBe("PLN");
  });
  it("aynı dosya iki kez okununca kimlikler aynı, satırlar arasında farklı", () => {
    const again = parseRevolutCsv(csv);
    expect(again.map((r) => r.ref)).toEqual(rows.map((r) => r.ref));
    expect(new Set(rows.map((r) => r.ref)).size).toBe(rows.length);
  });
  it("sayılar ve hatalı dosyalar", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("-25,33")).toBe(-25.33);
    expect(() => parseRevolutCsv("a,b\n1,2")).toThrow(StatementError);
    expect(() => parseRevolutCsv("﻿" + csv.split("\n")[0])).toThrow(StatementError);
  });
});

describe("önizleme — boş veriyle (her şey yeni)", () => {
  const empty: Dataset = { ...base, expenses: [], transfers: [], trips: [], meta: {} };
  const p = buildPreview(empty, parseRevolutCsv(csv), OPTS);
  it("kart harcamaları yeni; TOPUP/EXCHANGE/REVERTED atlanır; ücret ayrı kalem; transfer aday; iade", () => {
    const c = countBy(p.items);
    expect(c.new).toBe(6); // 5 kart harcaması + 1 kur ücreti
    expect(c.transfer).toBe(2);
    expect(c.skip).toBe(5); // TOPUP, 3 EXCHANGE, 1 REVERTED
    expect(c["refund-nomatch"]).toBe(1); // Amazon alışverişi bu veride yok
    expect(byDesc(p.items, "Biedronka").find((i) => i.row.state === "REVERTED")!.skip).toBe("reverted");
    expect(p.from).toBe("2026-10-06");
    expect(p.to).toBe("2026-11-10");
  });
  it("ücret kalemi: döviz satırının Fee'si, Banka & Kur Masrafı", () => {
    const fee = p.items.find((i) => i.isFee)!;
    expect(fee.expense).toMatchObject({ d: "2026-10-10", desc: "Revolut – kur çevirme ücreti", gross: 8.74, share: 8.74, cur: "PLN", cat: "Banka & Kur Masrafı", pay: "Revolut PLN", src: "bank" });
  });
  it("harcama: tutar pozitif, ödeme hesabı ve otomatik kategori", () => {
    const m = byDesc(p.items, "McDonald's")[0];
    expect(m.expense).toMatchObject({ d: "2026-11-09", gross: 6.19, share: 6.19, cur: "EUR", pay: "Revolut EUR", cat: "Yeme-İçme (dışarıda)" });
    expect(byDesc(p.items, "Bolt")[0].expense!.cat).toBe("Şehir İçi Ulaşım");
    expect(byDesc(p.items, "Biedronka")[0].expense!.cat).toBe("Market");
  });
  it("transfer adayı: kişi adı ve işaret", () => {
    const t = p.items.filter((i) => i.status === "transfer");
    expect(t[0].transfer).toMatchObject({ who: "ORNEK ARKADAS", amount: 10, cur: "PLN", acct: "Revolut PLN", closed: false });
    expect(t.every((i) => !i.selected)).toBe(true); // aday: kullanıcı seçmeden eklenmez
  });
});

describe("önizleme — elle girilmiş kayıtlarla (mükerrer tespiti)", () => {
  const ds = withManual();
  const p = buildPreview(ds, parseRevolutCsv(csv), { ...OPTS, checkedThrough: ds.meta.bankCheckedThrough });
  const st = (s: string) => byDesc(p.items, s).filter((i) => i.row.state !== "REVERTED").map((i) => i.status);
  it("elle girilenler mükerrer: aynı gün, aynı tutar; açıklamaya not eklenmiş olsa da", () => {
    expect(st("Biedronka")).toEqual(["dup"]);
    expect(st("Pijalnie")).toEqual(["dup"]);
    expect(p.items.find((i) => i.isFee)!.status).toBe("dup");
    expect(p.items.find((i) => i.isFee)!.match!.id).toBe("m3");
  });
  it("ortak ödemede kartın çektiği toplamla (gross) eşleşir", () => {
    expect(byDesc(p.items, "McDonald's")[0].match!.id).toBe("m4");
  });
  it("kontrol edilmemiş dönemde eşleşmeyen harcama yeni; gezi tarihleri içindeyse gezi önerilir", () => {
    const o = byDesc(p.items, "Osteria")[0];
    expect(o.status).toBe("new");
    expect(o.expense!.trip).toBe("it");
  });
  it("bankayla zaten kontrol edilmiş dönemde eşleşmeyen harcama yeni sayılmaz, seçilmez", () => {
    const q = buildPreview(ds, parseRevolutCsv(csv), { ...OPTS, checkedThrough: "2026-11-10" });
    for (const w of ["Bolt", "Osteria"]) {
      const o = byDesc(q.items, w)[0];
      expect(o.status).toBe("unmatched-old");
      expect(o.selected).toBe(false);
    }
    expect(q.items.filter((i) => i.selected && i.status === "new")).toEqual([]);
  });
  it("transfer zaten kayıtlıysa mükerrer", () => {
    expect(byDesc(p.items, "Transfer from").map((i) => i.status)).toEqual(["transfer", "dup"]);
  });
  it("iade ilgili harcamayı bulur; kontrol edilmiş dönemdeyse varsayılan seçilmez (iki kez düşmesin)", () => {
    const r = byDesc(p.items, "Amazon")[0];
    expect(r.status).toBe("refund");
    expect(r.refundTarget!.id).toBe("m5");
    expect(r.oldPeriod).toBe(true);
    expect(r.selected).toBe(false);
    const q = buildPreview(ds, parseRevolutCsv(csv), OPTS); // kontrol tarihi yoksa seçili gelir
    expect(byDesc(q.items, "Amazon")[0].selected).toBe(true);
  });
  it("hiçbir mevcut kayıt iki satırla eşleşmez; yeni harcamalar Bolt ve Osteria", () => {
    const ids = p.items.filter((i) => i.match).map((i) => i.match!.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(p.items.filter((i) => i.selected && i.status === "new").map((i) => i.row.desc)).toEqual(["Bolt", "Osteria Esempio"]);
  });
});

describe("onay sonrası yazma", () => {
  it("yalnızca seçilenler yazılır; iade düşülür; ikinci içe aktarmada her şey mükerrer", async () => {
    const ds = withManual();
    const d = new WalletDB("test-" + Math.random());
    await replaceAll(ds, d);
    const p = buildPreview(ds, parseRevolutCsv(csv), { ...OPTS, checkedThrough: ds.meta.bankCheckedThrough });
    // Kullanıcı Bolt'un kategorisini değiştiriyor → kural olarak öğrenilmeli
    const orig = Object.fromEntries(p.items.filter((i) => i.expense).map((i) => [i.ref, i.expense!.cat]));
    byDesc(p.items, "Bolt")[0].expense!.cat = "Seyahat Ulaşımı";
    byDesc(p.items, "Amazon")[0].selected = true; // kullanıcı iadeyi bilerek seçiyor
    const plan = planImport(ds, p.items, (a, cur, dd) => `İade −${a} ${cur} (${dd})`, orig);
    expect(plan.expenses.map((x) => x.desc)).toEqual(["Bolt", "Osteria Esempio"]);
    expect(plan.transfers).toHaveLength(0);
    const amazon = plan.updates.find((x) => x.id === "m5")!;
    expect(amazon.gross).toBe(486.35); // 618,34 − 131,99
    expect(amazon.share).toBe(486.35);
    expect(amazon.note).toContain("İade −131.99 PLN");
    expect(plan.rules).toEqual({ bolt: "Seyahat Ulaşımı" });

    await applyImport(plan, { at: "2026-11-20T10:00:00.000Z", file: "x.csv", from: p.from, to: p.to, added: 2, dup: 5 }, d);
    const after = await loadAll(d);
    expect(after.expenses).toHaveLength(ds.expenses.length + 2);
    const bolt = after.expenses.find((x) => x.desc === "Bolt" && x.d === "2026-10-10")!;
    expect(bolt.ts).toBeUndefined(); // banka kaydı; "kontrol bekliyor" değil
    expect(bolt.bankRef).toBeTruthy();
    expect(after.expenses.find((x) => x.id === "m1")!.bankRef).toBeTruthy(); // eşleşen kayda banka kimliği eklendi
    expect(after.expenses.find((x) => x.id === "m1")!.desc).toBe("Biedronka"); // başka hiçbir alanı değişmedi
    expect(after.rules).toEqual({ bolt: "Seyahat Ulaşımı" });
    expect(after.meta.lastImport!.added).toBe(2);

    // Aynı dosya tekrar: yeni bir şey yok, iade tekrar düşülmez
    const p2 = buildPreview(after, parseRevolutCsv(csv), { ...OPTS, checkedThrough: after.meta.bankCheckedThrough });
    expect(p2.items.filter((i) => i.selected)).toEqual([]);
    expect(byDesc(p2.items, "Amazon")[0].status).toBe("refund-done");
    expect(byDesc(p2.items, "Bolt")[0].match!.exact).toBe(true);
    d.close();
  });
  it("hiçbir şey seçilmezse hiçbir şey yazılmaz", () => {
    const ds = withManual();
    const p = buildPreview(ds, parseRevolutCsv(csv), OPTS);
    p.items.forEach((i) => (i.selected = false));
    const plan = planImport(ds, p.items, () => "");
    expect(plan.expenses).toEqual([]);
    expect(plan.transfers).toEqual([]);
    expect(plan.rules).toEqual({});
  });
});

describe("kategori önerisi", () => {
  it("öncelik: kullanıcının kuralı > geçmiş > bilinen satıcı > Diğer", () => {
    const hist = new Map([["biedronka", "Ev & Mutfak"]]);
    expect(suggestCat("BIEDRONKA 3172", { biedronka: "Diğer" }, hist)).toEqual(["Diğer", "rule"]);
    expect(suggestCat("Biedronka 3172", {}, hist)).toEqual(["Ev & Mutfak", "history"]);
    expect(suggestCat("Lidl sp. z o.o.", {}, hist)).toEqual(["Market", "keyword"]);
    expect(suggestCat("Xyz", {}, hist)).toEqual(["Diğer", "default"]);
  });
  it("açıklama benzerliği", () => {
    expect(similar("PIJALNIE CZEKOLADY", "Pijalnie Czekolady – mentor ile tatlı")).toBe(true);
    expect(similar("Uber *Trip", "Uber – dönüş")).toBe(true);
    expect(similar("Biedronka", "Lidl")).toBe(false);
  });
});

// ---------- Konsolide döküm (uydurma örnek: fixtures/revolut-konsolide-ornek.csv) ----------
import { isConsolidated, parseConsolidatedCsv, parseEnDate, parseStatement } from "./revolut";
import { mentionsAmount } from "./importer";

const cons = readFileSync(new URL("../../fixtures/revolut-konsolide-ornek.csv", import.meta.url), "utf8");

describe("konsolide döküm okuma", () => {
  const rows = parseConsolidatedCsv(cons);
  it("biçim otomatik tanınır; iki hesabın satırları okunur, özet/toplam satırları alınmaz", () => {
    expect(isConsolidated(cons)).toBe(true);
    expect(isConsolidated(csv)).toBe(false);
    expect(parseStatement(cons)).toEqual(rows);
    expect(rows).toHaveLength(12);
    expect(rows.filter((r) => r.cur === "EUR")).toHaveLength(5);
  });
  it("tarih, tutar, tür eşlemesi", () => {
    expect(parseEnDate("Oct 9, 2026")).toBe("2026-10-09");
    const b = rows.find((r) => r.desc === "Biedronka")!;
    expect(b).toMatchObject({ d: "2026-10-09", amount: -25.33, cur: "PLN", type: "CARD_PAYMENT", posted: true });
    expect(rows.find((r) => r.desc.startsWith("Uber"))!.type).toBe("CARD_PAYMENT"); // "Others" altındaki kart ödemesi
    expect(rows.find((r) => r.desc.startsWith("Transfer to"))!.type).toBe("TRANSFER");
    expect(rows.find((r) => r.desc === "Booking.com")).toMatchObject({ amount: -44.1, cur: "EUR" });
    expect(rows.find((r) => r.fee)).toMatchObject({ type: "EXCHANGE", fee: 8.74, d: "2026-10-10" });
    expect(rows.filter((r) => r.type === "TOPUP")).toHaveLength(1);
  });
});

describe("konsolide döküm — mükerrer tespiti", () => {
  const ds: Dataset = {
    ...base, trips: [{ id: "it", name: "İtalya", start: "2026-11-09", end: "2026-11-14", cities: [] }],
    meta: { bankCheckedThrough: "2026-11-16" }, transfers: [],
    expenses: [
      exp({ id: "k1", d: "2026-10-08", desc: "Biedronka", gross: 25.33 }), // döküm 1 gün sonra gösteriyor
      exp({ id: "k2", d: "2026-10-10", desc: "Revolut – kur çevirme ücreti", gross: 8.74 }),
      exp({ id: "k3", d: "2026-10-11", desc: "Uber – dönüş", gross: 6.56 }),
      exp({ id: "k4", d: "2026-10-13", desc: "Ödünç", gross: 10 }), // transfer olarak değil harcama olarak girilmiş
      exp({ id: "k5", d: "2026-11-02", desc: "Mestre Hostel (Booking.com)", gross: 56.1, share: 18.7, cur: "EUR", note: "44,10 € Booking.com + 12 € şehir vergisi nakit" }),
      exp({ id: "k6", d: "2026-11-11", desc: "ATAC (Roma toplu taşıma)", gross: 8.5, cur: "EUR", note: "Bankaya 14 Kas'ta düştü" }),
    ],
  };
  const p = buildPreview(ds, parseConsolidatedCsv(cons), { ...OPTS, checkedThrough: "2026-11-16" });
  const one = (s: string) => byDesc(p.items, s).find((i) => !i.isFee)!;
  it("hesaba geçiş tarihi 1 gün sonra olsa da eşleşir", () => {
    expect(one("Biedronka").match!.id).toBe("k1");
    expect(p.items.find((i) => i.isFee)!.match!.id).toBe("k2");
    expect(one("Uber").match!.id).toBe("k3");
  });
  it("açıklama benziyorsa 3 gün gecikme de kabul (toplu taşıma)", () => {
    expect(one("Atac").match!.id).toBe("k6");
  });
  it("birleştirilmiş kayıt: notunda banka tutarı yazıyor", () => {
    const b = one("Booking.com");
    expect(b.status).toBe("dup");
    expect(b.match).toMatchObject({ id: "k5", viaNote: true });
  });
  it("çekim + ertesi gün iade = net 0, ikisi de atlanır", () => {
    expect(byDesc(p.items, "Ornek Telefon").map((i) => [i.status, i.skip])).toEqual([["skip", "reversed"], ["skip", "reversed"]]);
  });
  it("giden transfer harcama olarak girilmişse mükerrer; gezi dönemindeki transfer işaretlenir", () => {
    expect(one("Transfer to").match!.id).toBe("k4");
    const tf = one("Transfer from");
    expect(tf.status).toBe("transfer");
    expect(tf.tripName).toBe("İtalya");
  });
  it("nakit ödenmiş kayıt banka satırıyla asla eşleşmez; arkadaşın ödediği kayıt yalnızca transferle eşleşir", () => {
    const rows = parseConsolidatedCsv(cons);
    const ds2: Dataset = { ...ds, expenses: [
      exp({ id: "n1", d: "2026-10-13", desc: "Otobüs", gross: 10, pay: "Nakit", src: "cash" }), // transferle aynı gün ve tutar
      exp({ id: "n2", d: "2026-10-11", desc: "Uber", gross: 6.56, pay: "Arkadaş ödedi", src: "friend" }),
    ] };
    const q = buildPreview(ds2, rows, OPTS);
    const tr = byDesc(q.items, "Transfer to")[0], ub = byDesc(q.items, "Uber")[0];
    expect(tr.status).toBe("transfer");
    expect(ub.status).toBe("new");
    const ds3: Dataset = { ...ds, expenses: [exp({ id: "n3", d: "2026-10-13", desc: "Akşam yemeği", gross: 10, pay: "Arkadaş ödedi", src: "friend" })] };
    expect(byDesc(buildPreview(ds3, rows, OPTS).items, "Transfer to")[0].match!.id).toBe("n3");
  });
  it("gelen para (Revolut Bank UAB +50 €) harcama sayılmaz; seçili hiçbir şey yok", () => {
    expect(one("Revolut Bank").skip).toBe("income");
    expect(p.items.filter((i) => i.selected)).toEqual([]);
  });
  it("notta tutar arama", () => {
    expect(mentionsAmount("44,10 € Booking.com + 12 € nakit", 44.1)).toBe(true);
    expect(mentionsAmount("toplam 144,10", 44.1)).toBe(false);
    expect(mentionsAmount("12 € şehir vergisi", 12)).toBe(true);
    expect(mentionsAmount("120 € vergi", 12)).toBe(false);
  });
});
