// Cihaz içi veritabanı (IndexedDB, Dexie ile).
// ÖNEMLİ: Şema değiştiğinde mevcut version() satırlarını SİLME/DEĞİŞTİRME;
// yeni bir db.version(N+1).stores(...).upgrade(...) ekle. Böylece kullanıcının verisi korunur.

import Dexie, { type Table } from "dexie";
import type { Account, Balance, Dataset, Expense, Inflow, Meta, Settings, Source, Transfer, Trip } from "../lib/types";

/** Ayarlar ve meta tek satırlık kayıtlar olarak "kv" tablosunda tutulur */
export interface KV {
  key: "settings" | "meta";
  value: Partial<Settings> | Meta;
}

export class WalletDB extends Dexie {
  expenses!: Table<Expense, string>;
  trips!: Table<Trip, string>;
  inflows!: Table<Inflow, string>;
  sources!: Table<Source, string>;
  accounts!: Table<Account, string>;
  balances!: Table<Balance, string>;
  transfers!: Table<Transfer, string>;
  kv!: Table<KV, string>;

  constructor(name = "erasmus-cuzdan") {
    super(name);
    // Sürüm 1 — ilk şema
    this.version(1).stores({
      expenses: "id, d, cat, trip, ts",
      trips: "id, start",
      inflows: "id, d",
      sources: "id",
      accounts: "id, order",
      balances: "id, d",
      transfers: "id, d",
      kv: "key",
    });
  }
}

export const db = new WalletDB();

const TABLES = ["expenses", "trips", "inflows", "sources", "accounts", "balances", "transfers"] as const;

/** Tüm veriyi tek seferde okur */
export async function loadAll(d: WalletDB = db): Promise<Dataset> {
  return d.transaction("r", [...TABLES.map((t) => d[t]), d.kv], async () => {
    const [expenses, trips, inflows, sources, accounts, balances, transfers, s, m] = await Promise.all([
      d.expenses.toArray(), d.trips.toArray(), d.inflows.toArray(), d.sources.toArray(),
      d.accounts.orderBy("order").toArray(), d.balances.toArray(), d.transfers.toArray(),
      d.kv.get("settings"), d.kv.get("meta"),
    ]);
    return {
      expenses, trips, inflows, sources, accounts, balances, transfers,
      settings: (s?.value as Partial<Settings>) || {},
      meta: (m?.value as Meta) || {},
    };
  });
}

/** Tüm veriyi verilen veri kümesiyle değiştirir (tek işlem: ya hepsi olur ya hiçbiri) */
export async function replaceAll(ds: Dataset, d: WalletDB = db) {
  await d.transaction("rw", [...TABLES.map((t) => d[t]), d.kv], async () => {
    for (const t of TABLES) await d[t].clear();
    await d.kv.clear();
    await d.expenses.bulkAdd(ds.expenses);
    await d.trips.bulkAdd(ds.trips);
    await d.inflows.bulkAdd(ds.inflows);
    await d.sources.bulkAdd(ds.sources);
    await d.accounts.bulkAdd(ds.accounts);
    await d.balances.bulkAdd(ds.balances);
    await d.transfers.bulkAdd(ds.transfers);
    await d.kv.bulkPut([{ key: "settings", value: ds.settings }, { key: "meta", value: ds.meta }]);
  });
}

export async function updateMeta(patch: Partial<Meta>, d: WalletDB = db) {
  await d.transaction("rw", d.kv, async () => {
    const cur = ((await d.kv.get("meta"))?.value as Meta) || {};
    await d.kv.put({ key: "meta", value: { ...cur, ...patch } });
  });
}

export async function isEmpty(d: WalletDB = db) {
  return (await d.expenses.count()) === 0 && (await d.trips.count()) === 0 && (await d.balances.count()) === 0;
}

/** Tarayıcıdan verileri kalıcı saklamasını ister (iPhone'da otomatik silinmeye karşı) */
export async function requestPersist() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* desteklenmiyorsa sorun değil */
  }
}
