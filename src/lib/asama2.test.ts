// Aşama 2: Analiz, Geziler, Para hesapları, CSV ve veri yazma. Uydurma veri (fixtures/ornek-yedek.json); beklenenler elle hesaplandı.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WalletDB, loadAll, removeRow, replaceAll, saveRow, saveSettings } from "../db/db";
import { parseBackup } from "./backup";
import { analysis, byCat, cfg, moneySummary, tripBankDiff, tripCities } from "./calc";
import { accountLabels, payOptions } from "./constants";
import { expensesCsv } from "./csv";

const text = readFileSync(new URL("../../fixtures/ornek-yedek.json", import.meta.url), "utf8");
const ds = parseBackup(text);
const TODAY = "2026-11-30";

describe("analiz", () => {
  const a = analysis(ds, "2026-11", "daily", TODAY);
  it("ay toplamı, gün sayısı ve kategoriler (depozito hariç, başkası için 0)", () => {
    expect(a.tot).toBe(55.5);
    expect(a.days).toBe(30);
    expect(a.cats.map(([k, o]) => [k, o.v, o.n])).toEqual([["Şehir İçi Ulaşım", 30, 1], ["Market", 25.5, 1], ["Yeme-İçme (dışarıda)", 0, 1]]);
  });
  it("gün gün ve geçen ayın aynı dönemi", () => {
    expect(a.daily!.vals[1]).toBe(30);
    expect(a.daily!.vals[14]).toBe(25.5);
    expect(a.daily!.prevSame).toBe(100);
    expect(a.daily!.delta).toBe(-44.5);
  });
  it("aylara göre günlük yaşam ve gezi ayrı", () => {
    expect(a.monthly).toEqual([{ k: "2026-10", daily: 100, trip: 40 }, { k: "2026-11", daily: 55.5, trip: 0 }]);
  });
  it("tüm dönem, yalnızca geziler", () => {
    const b = analysis(ds, "all", "trip", TODAY);
    expect(b.tot).toBe(40);
    expect(b.days).toBe(61);
    expect(b.daily).toBeNull();
  });
});

describe("geziler", () => {
  it("şehirlere göre ve bankayla fark", () => {
    const t = ds.trips[0];
    expect(tripCities(ds, t, "Diğer")).toEqual([["Roma", { v: 40, n: 1 }]]);
    expect(tripBankDiff(ds, t)).toBeNull();
    expect(tripBankDiff(ds, { ...t, bankNetPLN: 45 })).toBe(-5);
  });
  it("kategoriye göre", () => {
    expect(byCat(cfg(ds), ds.expenses.filter((x) => x.trip === "t1"))).toEqual([["Yeme-İçme (dışarıda)", { v: 40, n: 1 }]]);
  });
});

describe("para ekranı", () => {
  const m = moneySummary(ds);
  it("gelen, ücret, kaynaklara göre, harcanan", () => {
    expect(m.totPL).toBe(6060);
    expect(m.totEUR).toBe(1515);
    expect(m.fees).toBe(40);
    expect(m.bySrc).toEqual([["Kendi param", 4100], ["Hibe", 1960]]);
    expect(m.remain).toBe(5700);
    expect(m.spent).toBe(360);
  });
  it("hibe: gelen, kesinti sonrası, toplam", () => {
    expect(m.grant).toEqual({ total: 1000, received: 500, net: 490, note: "" });
  });
});

describe("hesap adları", () => {
  it("ödeme ve hesap seçenekleri dinamik hesaplardan gelir", () => {
    expect(accountLabels(ds.accounts)).toEqual(["Revolut PLN", "Revolut EUR", "Erste PLN", "Erste EUR", "Nakit"]);
    expect(payOptions(ds.accounts)).toEqual(["Revolut PLN", "Revolut EUR", "Erste PLN", "Erste EUR", "Nakit", "Arkadaş ödedi"]);
    expect(payOptions(ds.accounts, "Eski Banka")).toContain("Eski Banka"); // eski kayıttaki değer kaybolmaz
  });
});

describe("CSV dışa aktarma", () => {
  it("başlık + her harcama bir satır, virgüllü ondalık", () => {
    const csv = expensesCsv(ds, ["Tarih", "Yer"], (s) => s);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(8);
    expect(lines[1].startsWith("2026-09-28;")).toBe(true);
    const roma = lines.find((l) => l.includes("McDonald's"))!;
    expect(roma).toContain(";20,00;EUR;10,00;40,00;İtalya;Roma;bank;");
  });
});

describe("veri yazma", () => {
  it("kayıt eklenir/değişir/silinir; ts ve son giriş yazılır; ayarların diğer alanları korunur", async () => {
    const d = new WalletDB("test-" + Math.random());
    await replaceAll(ds, d);
    const e = { ...ds.expenses[1], id: "yeni", desc: "Lidl", share: 12, gross: 12 };
    await saveRow("expenses", e, d);
    let back = await loadAll(d);
    const saved = back.expenses.find((x) => x.id === "yeni")!;
    expect(saved.desc).toBe("Lidl");
    expect(saved.ts).toBeTruthy();
    expect(back.meta.lastEdit).toBe(saved.ts);
    expect(back.meta.bankCheckedThrough).toBe("2026-11-09"); // meta'nın diğer alanları korunur
    await saveRow("expenses", { ...e, desc: "Lidl 2" }, d);
    await removeRow("expenses", ds.expenses[0].id, d);
    await saveSettings({ budget: 2500 }, d);
    back = await loadAll(d);
    expect(back.expenses).toHaveLength(7);
    expect(back.expenses.find((x) => x.id === "yeni")!.desc).toBe("Lidl 2");
    expect(back.settings.budget).toBe(2500);
    expect(back.settings.eurpln).toBe(4);
    expect(back.settings.fixed).toHaveLength(2);
    d.close();
  });
});
