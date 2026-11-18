// Otomatik kategori önerisi. Öncelik: 1) kullanıcının kaydedilmiş kuralları, 2) daha önce aynı yere verdiği kategori,
// 3) bilinen satıcı adları, 4) "Diğer".
import { CATS } from "./constants";
import { merchant, norm } from "./search";
import type { Dataset, Expense } from "./types";

/** Satıcı anahtarı: "Biedronka 3172" ve "BIEDRONKA" → "biedronka" */
export const merchantKey = (s: string) => norm(String(s || "").replace(/\d+/g, " ").replace(/\s*\(.*?\)\s*/g, " ").split(" – ")[0]);

const KEYWORDS: [RegExp, string][] = [
  [/biedronka|lidl|zabka|żabka|carrefour|auchan|kaufland|netto|dino|stokrotka|lewiatan|aldi|spar|coop|conad|esselunga|polomarket|market/i, "Market"],
  [/mcdonald|kfc|burger|pizz|kebab|restaur|osteria|trattoria|cafe|caffe|coffee|starbucks|costa|pijalnie|bar\b|bistro|sushi|food|wolt|glovo|pyszne|bakery|piekarnia|gelat/i, "Yeme-İçme (dışarıda)"],
  [/bolt|uber|free ?now|mpk|ztm|jakdojade|komunikacja|bkm|tram|metro|atac/i, "Şehir İçi Ulaşım"],
  [/ryanair|wizz|flixbus|pkp|intercity|koleo|polregio|itabus|trenitalia|italo|\blot\b|airline|airport|lotnisko|easyjet|regiojet|blablacar/i, "Seyahat Ulaşımı"],
  [/booking|hostel|hotel|airbnb|akademik|dom studenta/i, "Yurt & Konaklama"],
  [/pepco|ikea|action|jysk|tedi|kik|homla|castorama|leroy|allegro/i, "Ev & Mutfak"],
  [/zara|h&m|\bhm\b|reserved|sinsay|tk ?maxx|primark|jd sports|decathlon|cropp|mohito|ccc|deichmann|half price|inter ?store/i, "Giyim"],
  [/rossmann|hebe|apteka|pharma|farmacia|dm-drogerie|super-pharm|barber|fryzjer|lekarz/i, "Kişisel Bakım & Sağlık"],
  [/orange|play\b|t-mobile|netflix|spotify|apple\.com|google|icloud|youtube|chatgpt|openai|disney/i, "Telefon & Abonelik"],
  [/pralnia|laundry|lavander|washing/i, "Çamaşır"],
  [/uniwersytet|university|politechnika|urząd|urzad|poczta|usos/i, "Okul & Resmi"],
  [/souvenir|magnet|pamiątk|pamiatk/i, "Hediyelik & Hatıra"],
  [/revolut|fee|opłata|oplata|prowizja/i, "Banka & Kur Masrafı"],
];

/** Geçmiş kayıtlardan satıcı → en sık kategori */
export function historyMap(expenses: Expense[], ds: Pick<Dataset, "trips">) {
  const m = new Map<string, Map<string, number>>();
  for (const x of expenses) {
    const k = merchantKey(merchant(ds, x));
    if (!k) continue;
    const c = m.get(k) || new Map<string, number>();
    c.set(x.cat, (c.get(x.cat) || 0) + 1);
    m.set(k, c);
  }
  const out = new Map<string, string>();
  for (const [k, c] of m) out.set(k, [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return out;
}

export type CatSource = "rule" | "history" | "keyword" | "default";

export function suggestCat(desc: string, rules: Record<string, string>, history: Map<string, string>): [string, CatSource] {
  const k = merchantKey(desc);
  if (k && rules[k] && CATS.includes(rules[k])) return [rules[k], "rule"];
  if (k && history.has(k)) return [history.get(k)!, "history"];
  for (const [re, c] of KEYWORDS) if (re.test(desc)) return [c, "keyword"];
  return ["Diğer", "default"];
}
