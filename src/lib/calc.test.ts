import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { balTotal, cfg, isPending, latestBalance, mine, moneyCheck, monthSummary, openFriends, plan, tripStats } from "./calc";
import { matches, merchant } from "./search";

// Uydurma veri (fixtures/ornek-yedek.json). Beklenen rakamlar elle hesaplandı.
const ds = parseBackup(readFileSync(new URL("../../fixtures/ornek-yedek.json", import.meta.url), "utf8"));
const c = cfg(ds);
const ex = (id: string) => ds.expenses.find((x) => x.id === id)!;

describe("temel hesaplar", () => {
  it("kullanıcının payı: EUR kurla zł'ye çevrilir, depozito sayılmaz", () => {
    expect(mine(c, ex("e2"))).toBe(100);
    expect(mine(c, ex("e4"))).toBe(40); // 10 € × 4
    expect(mine(c, ex("e3"))).toBe(0); // depozito
    expect(mine(c, ex("e6"))).toBe(0); // başkası için
  });

  it("son bakiye ve toplamı", () => {
    const b = latestBalance(ds)!;
    expect(b.d).toBe("2026-11-15");
    // 1000 + 100€×4 + 2000 + 500€×4 + 300 = 5700
    expect(balTotal(c, ds.accounts, b)).toBe(5700);
  });

  it("gezi toplamı", () => {
    const s = tripStats(ds, ds.trips[0]);
    expect(s.tot).toBe(40);
    expect(s.days).toBe(3);
    expect(s.xs).toHaveLength(1);
  });

  it("banka kontrolünden sonra eklenenler 'yeni' sayılır", () => {
    expect(isPending(ds, ex("e6"))).toBe(true);
    expect(isPending(ds, ex("e7"))).toBe(false);
    expect(isPending(ds, ex("e2"))).toBe(false);
  });

  it("açık arkadaş hesapları kişi adına göre toplanır, kapananlar sayılmaz", () => {
    expect(openFriends(ds)).toEqual([["Ali", 30]]);
  });
});

describe("para kontrolü", () => {
  const m = moneyCheck(ds, "2026-11-30");
  it("gelen − kalan = harcanan", () => {
    expect(m.incoming).toBe(6060); // 4100 + (500−10)×4
    expect(m.remain).toBe(5700);
    expect(m.spent).toBe(360);
  });
  it("kayıtlı harcamalar ilk girişten son bakiyeye kadar sayılır", () => {
    expect(m.from).toBe("2026-09-29");
    expect(m.to).toBe("2026-11-15");
    expect(m.recorded).toBe(195.5); // 100 + 40 + 30 + 25,5
  });
  it("açıklanamayan fark ve %5 kuralı", () => {
    expect(m.gap).toBeCloseTo(-335.5, 6);
    expect(m.ok).toBe(false);
  });
});

describe("plan", () => {
  const p = plan(ds, "2026-11-30");
  it("kalan gün/ay", () => {
    expect(p.left).toBe(62);
    expect(p.months).toBeCloseTo(62 / 30.4, 9);
  });
  it("gereken", () => {
    expect(p.varBudget).toBe(1400); // 2000 − 600 kira
    expect(p.needFixed).toBe(2000); // 600×2 + 800×1
    expect(p.needVar).toBeCloseTo(1400 * (62 / 30.4), 6);
    expect(p.buffer).toBeCloseTo((p.needVar + 2000 + 1000) * 0.1, 6);
    expect(p.need).toBeCloseTo(6440.789474, 5);
  });
  it("kaynak ve yatırıma ayrılabilir", () => {
    expect(p.monthlyIncTL).toBe(9000); // 5000 TL + 100€×40
    expect(p.inc).toBe(1800); // 9000 × 2 / 10
    expect(p.tr).toBe(5000);
    expect(p.invest).toBeCloseTo(5700 + 1800 + 5000 - 6440.789474, 5);
    expect(p.fromTR).toBe(0);
  });
});

describe("ana sayfa ay özeti", () => {
  it("günlük yaşam ayrı, gezi ayrı", () => {
    const s = monthSummary(ds, "2026-11-30");
    expect(s.dSum).toBe(55.5);
    expect(s.tSum).toBe(0);
    expect(s.perDay).toBe(1944.5);
    expect(s.perDayVals[1]).toBe(30); // 2 Kasım
  });
});

describe("arama", () => {
  it("mağaza adı açıklamadan çıkarılır", () => {
    expect(merchant(ds, ex("e4"))).toBe("McDonald's");
    expect(merchant(ds, ex("e2"))).toBe("Biedronka");
  });
  it("kelime ve tutar eşleşmesi, Türkçe karakterlerden bağımsız", () => {
    expect(matches(ds, ex("e4"), "mcdonalds roma")).toBe(true);
    expect(matches(ds, ex("e4"), "10")).toBe(true);
    expect(matches(ds, ex("e4"), "italya")).toBe(true);
    expect(matches(ds, ex("e7"), "żabka")).toBe(true); // Lehçe harfler de eşleşir
    expect(matches(ds, ex("e7"), "25,5")).toBe(true);
    expect(matches(ds, ex("e2"), "bolt")).toBe(false);
  });
});
