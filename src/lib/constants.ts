import type { Account, ExpenseSrc, Settings } from "./types";

/** Kategori → [lucide ikon adı, renk] */
export const CAT: Record<string, [string, string]> = {
  "Market": ["shopping-cart", "#16A34A"],
  "Yeme-İçme (dışarıda)": ["utensils", "#F97316"],
  "Şehir İçi Ulaşım": ["bus", "#0EA5E9"],
  "Seyahat Ulaşımı": ["plane", "#6366F1"],
  "Yurt & Konaklama": ["bed-double", "#8B5CF6"],
  "Ev & Mutfak": ["sofa", "#B7791F"],
  "Giyim": ["shirt", "#EC4899"],
  "Kişisel Bakım & Sağlık": ["heart-pulse", "#EF4444"],
  "Telefon & Abonelik": ["smartphone", "#14B8A6"],
  "Çamaşır": ["washing-machine", "#06B6D4"],
  "Okul & Resmi": ["graduation-cap", "#64748B"],
  "Hediyelik & Hatıra": ["gift", "#D946EF"],
  "Banka & Kur Masrafı": ["landmark", "#78716C"],
  "Diğer": ["circle-ellipsis", "#94A3B8"],
};
export const CATS = Object.keys(CAT);
export const catInfo = (c: string) => CAT[c] ?? CAT["Diğer"];

/** Mağaza renkli avatarları: [aranan, harf, arka plan, yazı] */
export const BRANDS: [string, string, string, string][] = [
  ["biedronka", "B", "#E30613", "#FFE500"], ["mcdonald", "M", "#DA291C", "#FFC72C"], ["bolt", "B", "#2DC56F", "#fff"],
  ["uber", "U", "#111", "#fff"], ["ryanair", "R", "#073590", "#F1C933"], ["flixbus", "F", "#73D700", "#fff"],
  ["rossmann", "R", "#C3002D", "#fff"], ["pepco", "P", "#0071CE", "#fff"], ["zara", "Z", "#111", "#fff"],
  ["amazon", "a", "#232F3E", "#FF9900"], ["kfc", "K", "#A3080C", "#fff"], ["zabka", "Ż", "#00843D", "#fff"],
  ["lidl", "L", "#0050AA", "#FFF000"], ["tk maxx", "T", "#C8102E", "#fff"], ["jd sports", "JD", "#111", "#fff"],
  ["inter store", "I", "#0068A8", "#fff"], ["koleo", "K", "#E4002B", "#fff"], ["orange", "o", "#FF7900", "#fff"],
  ["booking", "B", "#003580", "#fff"], ["tendur", "T", "#7A3E1D", "#fff"], ["half price", "H", "#E4007C", "#fff"],
  ["itabus", "I", "#00A651", "#fff"], ["revolut", "R", "#191C1F", "#fff"], ["allegro", "a", "#FF5A00", "#fff"],
  ["türk marketi", "T", "#C8102E", "#fff"],
];
export const brandOf = (t: string | undefined) => {
  const n = String(t || "").toLowerCase();
  return BRANDS.find((b) => n.includes(b[0]));
};

export const PAYS = ["Revolut PLN", "Revolut EUR", "Erste PLN", "Erste EUR", "Nakit", "Arkadaş ödedi"];
export const PAY_CASH = "Nakit";
export const PAY_FRIEND = "Arkadaş ödedi";

/** Hesabın kısa adı: "Revolut PLN", nakit için yalnızca "Nakit" (prototipteki ödeme adlarıyla aynı) */
export const accountLabel = (a: Account) => (a.bank === PAY_CASH ? PAY_CASH : `${a.bank} ${a.cur}`);
/** Hesap listesinden benzersiz adlar; `keep` (kayıttaki mevcut değer) listede yoksa sona eklenir */
export function accountLabels(accounts: Account[], keep?: string) {
  const l = [...new Set(accounts.map(accountLabel))];
  if (keep && !l.includes(keep)) l.push(keep);
  return l;
}
/** Harcama formundaki ödeme seçenekleri: hesaplar + nakit + "arkadaş ödedi" */
export function payOptions(accounts: Account[], keep?: string) {
  const l = accountLabels(accounts).filter((x) => x !== PAY_CASH);
  l.push(PAY_CASH, PAY_FRIEND);
  if (keep && !l.includes(keep)) l.push(keep);
  return l;
}

/** Para girişi seçenekleri (veride Türkçe saklanır, ekranda sözlükle çevrilir) */
export const VIA = ["Wise", "Banka havalesi", "Nakit getirdim", "Döviz bürosu", "Revolut transferi", "Kart / Apple Pay", "Diğer"];
export const INSRC = ["Hibe", "Burs", "Kredi", "Aile desteği", "Kendi param", "Hediye", "Diğer"];
export const FREQ_MONTHLY = "Aylık";
/** Para birimi seçenekleri */
export const CURS = ["PLN", "EUR"];
export const IN_CURS = ["EUR", "PLN", "TL"];

export const SRC: Record<ExpenseSrc, [string, string]> = {
  bank: ["Banka ✓", "bank"],
  cash: ["Nakit", "cash"],
  friend: ["Arkadaş ödedi", "friend"],
  note: ["Sadece not", "note"],
};

/** Prototipteki sabit hesaplar. v1 yedeklerindeki alan adlarıyla aynı id'ler kullanılır. */
export const LEGACY_ACCOUNTS: Account[] = [
  { id: "revPLN", bank: "Revolut", cur: "PLN", order: 1 },
  { id: "revEUR", bank: "Revolut", cur: "EUR", order: 2 },
  { id: "erstePLN", bank: "Erste", cur: "PLN", order: 3 },
  { id: "ersteEUR", bank: "Erste", cur: "EUR", order: 4 },
  { id: "cashPLN", bank: "Nakit", cur: "PLN", order: 5 },
  { id: "cashEUR", bank: "Nakit", cur: "EUR", order: 6 },
];

/** Ana sayfadaki banka kutularının görünümü (bilinmeyen bankalar sırayla renk alır) */
export const BANK_STYLE: Record<string, [string, string]> = {
  Revolut: ["R", "linear-gradient(150deg,#15171C,#2B2F38)"],
  Erste: ["E", "linear-gradient(150deg,#0B4FB3,#2A7DE1)"],
  Nakit: ["¤", "linear-gradient(150deg,#0B6B4A,#17A673)"],
};
export const BANK_FALLBACK = [
  "linear-gradient(150deg,#5B21B6,#8B5CF6)",
  "linear-gradient(150deg,#9F1239,#E11D48)",
  "linear-gradient(150deg,#92400E,#D97706)",
];

export const DEF: Settings = {
  eurpln: 4.39, plntl: 12.75, eurtl: 55.6, budget: 2000, start: "2026-10-01", end: "2027-01-31", endConfirmed: false,
  deposit: 0, trTL: 0, totalTL: 0, tripBudget: 0, buffer: 10, incomeLeft: 0, fixed: [],
};

