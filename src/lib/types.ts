// Uygulamanın veri modeli. CLAUDE.md'deki "Veri modeli" bölümüyle birebir.

export type Cur = string; // "PLN" | "EUR" | "TL" ...

export type ExpenseSrc = "bank" | "cash" | "friend" | "note";

export interface Expense {
  id: string;
  /** İşlemin yapıldığı gün, YYYY-MM-DD */
  d: string;
  desc: string;
  cat: string;
  pay: string;
  /** Karttan / elden çıkan toplam */
  gross: number;
  /** Kullanıcının payı */
  share: number;
  cur: Cur;
  /** Gezi id'si; boşsa günlük yaşam */
  trip: string;
  city: string;
  note: string;
  src: ExpenseSrc;
  /** "deposit" → listede görünür, toplamlara sayılmaz */
  kind?: "deposit";
  /** Kullanıcının eklediği/düzenlediği zaman (ISO) */
  ts?: string;
  /** Banka dökümündeki satırın kimliği (içe aktarılan ya da dökümle eşleşen kayıtlar) */
  bankRef?: string;
  /** Bu harcamadan düşülmüş iadelerin banka kimlikleri */
  refundRefs?: string[];
}

export interface Trip {
  id: string;
  name: string;
  start: string;
  end: string;
  cities: string[];
  with?: string;
  note?: string;
  bankNetPLN?: number;
}

export interface Inflow {
  id: string;
  d: string;
  desc: string;
  amount: number;
  cur: Cur;
  fee: number;
  /** Doluysa gerçekleşen zł karşılığı */
  pln?: number;
  source: string;
  via: string;
  to: string;
  note: string;
}

export interface Source {
  id: string;
  name: string;
  amount: number;
  cur: Cur;
  freq: "Aylık" | "Tek seferlik" | string;
  note?: string;
  order?: number;
}

/** Kullanıcının hesabı (dinamik liste): ör. Revolut / PLN */
export interface Account {
  id: string;
  /** Banka adı; aynı bankanın hesapları ana sayfada tek kutuda gösterilir */
  bank: string;
  cur: Cur;
  order: number;
}

/** Belirli bir gündeki tüm hesap bakiyeleri */
export interface Balance {
  id: string;
  d: string;
  /** hesap id → tutar (hesabın kendi para biriminde) */
  amounts: Record<string, number>;
  ts?: string;
}

export interface Transfer {
  id: string;
  d: string;
  who: string;
  acct: string;
  /** + gelen / − giden */
  amount: number;
  cur: Cur;
  why: string;
  closed: boolean;
  bankRef?: string;
}

export interface FixedPayment {
  name: string;
  amount: number;
  left: number;
  monthly: boolean;
}

export interface Settings {
  eurpln: number;
  plntl: number;
  eurtl: number;
  budget: number;
  start: string;
  end: string;
  endConfirmed?: boolean;
  deposit: number;
  depositDate?: string;
  trTL: number;
  totalTL: number;
  tripBudget: number;
  shopBudget?: number;
  overrun?: number;
  buffer: number;
  incomeLeft: number;
  fixed: FixedPayment[];
}

export interface Meta {
  lastEdit?: string;
  bankCheckedThrough?: string;
  lastBankCheckAt?: string;
  bankCheckNote?: string;
  /** Son JSON yedeğinin indirildiği zaman */
  lastBackupAt?: string;
  /** Son banka dökümü içe aktarması */
  lastImport?: { at: string; file: string; from: string; to: string; added: number; dup: number };
}

/** Kullanıcının düzeltmelerinden öğrenilen kurallar: satıcı anahtarı → kategori */
export type Rules = Record<string, string>;

/** Uygulamanın tüm verisi */
export interface Dataset {
  settings: Partial<Settings>;
  meta: Meta;
  expenses: Expense[];
  trips: Trip[];
  inflows: Inflow[];
  sources: Source[];
  accounts: Account[];
  balances: Balance[];
  transfers: Transfer[];
  /** Öğrenilen kategori kuralları (eski yedeklerde yok → boş) */
  rules?: Rules;
}
