// Kullanıcının GERÇEK Revolut dökümleriyle deneme (data/ git'e girmez; dosyalar yoksa test atlanır).
// Hem normal Revolut CSV'si hem konsolide döküm (consolidated_statement_*.csv) tanınır.
// Beklenti: yedekteki kayıtlar zaten bankayla kontrol edildiği için önizlemede hiçbir yeni harcama/transfer seçili gelmemeli.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { buildPreview, countBy } from "./importer";
import { isConsolidated, parseStatement } from "./revolut";

const dir = new URL("../../data/", import.meta.url);
const read = (f: string) => readFileSync(new URL(f, dir), "utf8").replace(/^﻿/, "");
const isStatement = (t: string) => /^Type,Product,Started Date/.test(t) || isConsolidated(t);
const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.csv$/i.test(f) && isStatement(read(f))) : [];
const backupName = existsSync(dir) ? readdirSync(dir).filter((f) => /^erasmus-cuzdan-yedek-.*\.json$/.test(f)).sort().pop() : undefined;

describe.skipIf(!files.length || !backupName)("gerçek Revolut dökümleri", () => {
  // describe.skipIf atlasa da bu blok çalışır: dosya yoksa okumaya çalışma
  const ds = backupName ? parseBackup(read(backupName)) : (null as never);
  for (const f of files) {
    it(f + ": yeni bir şey eklenmiyor", () => {
      const p = buildPreview(ds, parseStatement(read(f)), {
        bank: "Revolut", feeDesc: { exchange: "Revolut – kur çevirme ücreti", other: "Revolut – ücret" }, checkedThrough: ds.meta.bankCheckedThrough,
      });
      // Ayrıntı: hata ayıklamak için eşleşmeyenleri yazdır (yalnızca bu bilgisayarın konsolunda)
      console.log(f, countBy(p.items), p.from, "→", p.to);
      for (const i of p.items.filter((x) => !["dup", "skip"].includes(x.status)))
        console.log("  ", i.status, i.selected ? "[SEÇİLİ]" : "", i.row.d, i.row.type, i.row.desc, i.row.amount, i.row.cur, i.refundTarget ? "→ " + i.refundTarget.label : "");
      expect(p.items.filter((i) => i.selected).map((i) => `${i.row.d} ${i.row.desc} ${i.row.amount}`)).toEqual([]);
    });
  }
});
