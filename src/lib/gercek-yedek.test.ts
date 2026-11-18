// Kullanıcının GERÇEK yedeğiyle karşılaştırma testi.
// data/ klasörü git'e girmez; bu yüzden hem yedek hem beklenen rakamlar (data/beklenen-degerler.json)
// yalnızca bu bilgisayarda bulunur. Dosyalar yoksa test atlanır.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { moneyCheck, plan, tripStats } from "./calc";

const dir = new URL("../../data/", import.meta.url);
const expFile = new URL("beklenen-degerler.json", dir);
const backupName = existsSync(dir) ? readdirSync(dir).filter((f) => /^erasmus-cuzdan-yedek-.*\.json$/.test(f)).sort().pop() : undefined;
const ready = !!backupName && existsSync(expFile);

describe.skipIf(!ready)("gerçek yedek prototiple aynı rakamları veriyor", () => {
  const E = ready ? JSON.parse(readFileSync(expFile, "utf8")) : {};
  const ds = ready ? parseBackup(readFileSync(new URL(backupName!, dir), "utf8")) : (null as never);

  it("harcama sayısı", () => {
    expect(ds.expenses.length).toBe(E.expenseCount);
  });
  it("gezi toplamları", () => {
    for (const [id, tot] of Object.entries(E.trips as Record<string, number>)) {
      const t = ds.trips.find((x) => x.id === id)!;
      expect(+tripStats(ds, t).tot.toFixed(2)).toBe(tot);
    }
  });
  it("para kontrolü", () => {
    const m = moneyCheck(ds, E.today);
    for (const k of ["incoming", "remain", "spent", "recorded", "gap"] as const) expect(m[k]).toBeCloseTo(E.moneyCheck[k], 2);
    expect(m.ok).toBe(E.moneyCheck.ok);
  });
  it("plan", () => {
    const p = plan(ds, E.today);
    for (const k of Object.keys(E.plan)) expect(p[k as keyof typeof p]).toBeCloseTo(E.plan[k], 2);
  });
});
