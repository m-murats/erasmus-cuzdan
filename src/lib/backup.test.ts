import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WalletDB, loadAll, replaceAll } from "../db/db";
import { BackupError, FORMAT_V2, makeBackup, parseBackup } from "./backup";

const text = readFileSync(new URL("../../fixtures/ornek-yedek.json", import.meta.url), "utf8");

describe("yedek içe/dışa aktarma", () => {
  it("v1 yedeği okunur, bakiyeler dinamik hesaplara çevrilir", () => {
    const ds = parseBackup(text);
    expect(ds.expenses).toHaveLength(7);
    expect(ds.accounts.map((a) => a.id)).toEqual(["revPLN", "revEUR", "erstePLN", "ersteEUR", "cashPLN", "cashEUR"]);
    const b2 = ds.balances.find((b) => b.id === "b2")!;
    expect(b2.amounts).toEqual({ revPLN: 1000, revEUR: 100, erstePLN: 2000, ersteEUR: 500, cashPLN: 300, cashEUR: 0 });
    expect(b2.ts).toBe("2026-11-15T09:00:00.000Z"); // ek alanlar kaybolmaz
    expect(ds.sources[0].order).toBe(1);
  });

  it("v2 olarak dışa aktarıp geri okuyunca hiçbir şey değişmez", () => {
    const ds = parseBackup(text);
    const out = makeBackup(ds, new Date("2026-12-01T00:00:00Z"));
    expect(JSON.parse(out).format).toBe(FORMAT_V2);
    expect(parseBackup(out)).toEqual(ds);
  });

  it("hatalı dosyalar reddedilir", () => {
    expect(() => parseBackup("merhaba")).toThrow(BackupError);
    expect(() => parseBackup('{"a":1}')).toThrow(BackupError);
    expect(() => parseBackup('{"format":"baska","expenses":[]}')).toThrow(BackupError);
  });

  it("veritabanına yazıp okuyunca aynı veri gelir", async () => {
    const ds = parseBackup(text);
    const d = new WalletDB("test-" + Math.random());
    await replaceAll(ds, d);
    const back = await loadAll(d);
    const byId = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id));
    expect(byId(back.expenses)).toEqual(byId(ds.expenses));
    expect(byId(back.balances)).toEqual(byId(ds.balances));
    expect(back.accounts).toEqual(ds.accounts);
    expect(back.settings).toEqual(ds.settings);
    expect(back.meta).toEqual(ds.meta);
    // ikinci geri yükleme eskisini tamamen değiştirir
    await replaceAll({ ...ds, expenses: ds.expenses.slice(0, 2) }, d);
    expect((await loadAll(d)).expenses).toHaveLength(2);
    d.close();
  });
});
