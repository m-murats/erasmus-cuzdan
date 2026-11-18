// Arayüzdeki TÜM metinler burada. Yeni bir yazı eklerken hem tr hem en karşılığını yaz.
// Not: Kategori adları veride Türkçe anahtar olarak saklanır (yedek uyumluluğu); ekranda `cats` ile çevrilir.

const tr = {
  langName: "Türkçe",
  appTitle: "Erasmus Cüzdanım",
  months: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  days: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  cats: {} as Record<string, string>, // Türkçede anahtarın kendisi gösterilir
  src: { bank: "Banka ✓", cash: "Nakit", friend: "Arkadaş ödedi", note: "Sadece not" },
  nav: { home: "Ana sayfa", tx: "Hareketler", analysis: "Analiz", trips: "Geziler", money: "Para", mainMenu: "Ana menü" },
  common: {
    back: "Geri", search: "Ara", menu: "Menü ve ayarlar", close: "Kapat", cancel: "Vazgeç", clear: "Temizle",
    soon: "Bu ekran bir sonraki aşamada eklenecek.", loading: "Yükleniyor…",
  },
  upd: {
    lastEntry: "Son giriş", bankCheck: "bankayla kontrol", until: (d: string) => `${d}'a kadar`, none: "yok",
    pending: (n: number) => `${n} yeni kayıt kontrol bekliyor`,
  },
  home: {
    myMoney: "Polonya'daki param", balanceRecord: (d: string) => `${d} bakiye kaydı`, inTurkey: "Türkiye'de",
    add: "Ekle", search: "Ara", balance: "Bakiye", plan: "Plan",
    spending: (m: string) => `${m} harcaması`, analysis: "Analiz",
    vsLastMonth: "Geçen ayın aynı dönemine göre",
    leftPerDay: "Kalan bütçe/gün", tripSeparate: "Gezi (ayrı)", monthTotal: "Ay toplamı",
    recent: "Son hareketler", all: "Tümü", noExpenses: "Henüz harcama yok.",
    planTitle: "Erasmus planı", daysLeft: (n: number) => `${n} gün kaldı`, need: "ihtiyaç",
    investable: "plana göre yatırıma ayrılabilir",
    alertPending: (n: number) => `<b>${n} yeni kayıt</b> son banka kontrolünden sonra eklendi`,
    alertFriends: (n: number) => `<b>${n} kişiyle</b> açık hesap var`,
    alertFixed: (names: string) => `<b>${names}</b> için tutar girilmedi`,
    alertTripBudget: "<b>Gezi bütçesi</b> belirlenmedi; dönüşe kadar gezi planın varsa ekle",
    alertBackup: (days: number | null) =>
      days == null ? "<b>Henüz yedek almadın.</b> Verilerin yalnızca bu cihazda; bir yedek indir." : `<b>Son yedek ${days} gün önce.</b> Yeni bir yedek indir.`,
    empty: "Henüz veri yok. Eski uygulamadan aldığın yedeği yükleyerek başlayabilirsin.",
    emptyBtn: "Yedekten geri yükle",
    dailyChart: "Bu ay günlük harcama",
  },
  tx: {
    placeholder: "Ara: McDonald's, Bolt, Roma, 26…", searchLabel: "Harcamalarda ara",
    allPeriod: "Tüm dönem", all: "Tümü", daily: "Günlük yaşam", pending: "Yeni eklenenler", allCats: "Tüm kategoriler",
    clearFilters: "Filtreleri temizle", count: (n: number) => `${n} işlem`, avg: "ort.", top: "En çok:",
    noResults: "Sonuç yok. Başka bir kelime dene ya da filtreleri kaldır.",
    period: "Dönem", kind: "Tür", category: "Kategori",
    shared: "ortak", forOthers: "Başkası için", deposit: "Depozito · harcamaya sayılmaz", yourShare0: "senin payın 0",
    total: "toplam", isNew: "Yeni",
  },
  detail: {
    category: "Kategori", payment: "Ödeme", plnValue: "PLN karşılığı", totalPaid: "Toplam ödenen", yourShare: "Senin payın",
    trip: "Gezi", verification: "Doğrulama", type: "Tür", depositType: "Depozito · harcama toplamlarına eklenmez", note: "Not",
    allAt: (m: string) => `${m} · tüm harcamalar`,
  },
  merchant: { title: "Yer", empty: "Bir harcamaya dokunup \"tüm harcamalar\"ı seç." },
  more: {
    title: "Daha fazla",
    items: {
      para: ["Para girişleri ve hibe", "Getirdiğin ve gelen tüm paralar"],
      plan: ["Erasmus planı ve para kontrolü", "Gelirler, bakiyeler, yatırıma ayrılabilecek tutar"],
      arkadaslar: ["Arkadaşlar", "Para alışverişleri ve açık hesaplar"],
      ayarlar: ["Ayarlar ve yedek", "Dil, yedek indirme ve geri yükleme"],
    } as Record<string, [string, string]>,
  },
  settings: {
    title: "Ayarlar ve yedek", language: "Dil",
    backupTitle: "Yedek",
    backupInfo: "Verilerin yalnızca bu cihazda saklanır, hiçbir sunucuya gönderilmez. Telefon değiştirirsen veya tarayıcı verileri silinirse diye düzenli yedek indir.",
    lastBackup: "Son yedek", never: "hiç alınmadı",
    download: "Yedek indir (JSON)", restore: "Yedekten geri yükle",
    downloaded: "Yedek indirildi",
    previewTitle: "Bu yedek yüklensin mi?",
    previewCounts: "Yedekteki kayıtlar",
    labels: { expenses: "Harcama", trips: "Gezi", inflows: "Para girişi", balances: "Bakiye kaydı", transfers: "Transfer", sources: "Gelir kaynağı" } as Record<string, string>,
    exportedAt: "Yedek tarihi",
    replaceWarn: "Bu cihazdaki mevcut veriler yedektekilerle değiştirilecek. Önce şu anki verilerin otomatik olarak yedek dosyası olarak indirilecek.",
    confirmRestore: "Evet, yükle", restored: (n: number) => `Yedek yüklendi · ${n} harcama`,
    statusTitle: "Güncellik", lastEntry: "Son giriş", bankCheck: "Bankayla kontrol", source: "Kaynak", addedLater: "Sonradan eklenen",
    expensesN: (n: number) => `${n} harcama`,
    storage: "Kalıcı depolama", storageOn: "açık ✓", storageOff: "tarayıcı izin vermedi",
  },
  errors: {
    readFile: "Dosya okunamadı",
    notJson: "Dosya okunamadı: geçerli bir JSON yedeği değil.",
    notBackup: "Bu dosya bir Erasmus Cüzdanı yedeği gibi görünmüyor (harcama listesi yok).",
    unknownFormat: (f: string) => `Bilinmeyen yedek formatı: ${f}`,
  },
};

export type Dict = typeof tr;

const en: Dict = {
  langName: "English",
  appTitle: "My Erasmus Wallet",
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  cats: {
    "Market": "Groceries", "Yeme-İçme (dışarıda)": "Eating out", "Şehir İçi Ulaşım": "Local transport",
    "Seyahat Ulaşımı": "Travel transport", "Yurt & Konaklama": "Dorm & accommodation", "Ev & Mutfak": "Home & kitchen",
    "Giyim": "Clothing", "Kişisel Bakım & Sağlık": "Personal care & health", "Telefon & Abonelik": "Phone & subscriptions",
    "Çamaşır": "Laundry", "Okul & Resmi": "School & official", "Hediyelik & Hatıra": "Gifts & souvenirs",
    "Banka & Kur Masrafı": "Bank & FX fees", "Diğer": "Other",
  },
  src: { bank: "Bank ✓", cash: "Cash", friend: "Friend paid", note: "Note only" },
  nav: { home: "Home", tx: "Activity", analysis: "Insights", trips: "Trips", money: "Money", mainMenu: "Main menu" },
  common: {
    back: "Back", search: "Search", menu: "Menu and settings", close: "Close", cancel: "Cancel", clear: "Clear",
    soon: "This screen is coming in the next stage.", loading: "Loading…",
  },
  upd: {
    lastEntry: "Last entry", bankCheck: "bank-checked", until: (d: string) => `through ${d}`, none: "never",
    pending: (n: number) => `${n} new entries awaiting check`,
  },
  home: {
    myMoney: "My money abroad", balanceRecord: (d: string) => `balance as of ${d}`, inTurkey: "At home",
    add: "Add", search: "Search", balance: "Balance", plan: "Plan",
    spending: (m: string) => `${m} spending`, analysis: "Insights",
    vsLastMonth: "Compared with the same period last month",
    leftPerDay: "Budget left/day", tripSeparate: "Trips (separate)", monthTotal: "Month total",
    recent: "Recent activity", all: "See all", noExpenses: "No expenses yet.",
    planTitle: "Erasmus plan", daysLeft: (n: number) => `${n} days left`, need: "need",
    investable: "left over to invest, per plan",
    alertPending: (n: number) => `<b>${n} new entries</b> added since the last bank check`,
    alertFriends: (n: number) => `Open balance with <b>${n} ${n === 1 ? "person" : "people"}</b>`,
    alertFixed: (names: string) => `No amount entered for <b>${names}</b>`,
    alertTripBudget: "<b>No trip budget</b> set; add one if you plan to travel",
    alertBackup: (days: number | null) =>
      days == null ? "<b>No backup yet.</b> Your data lives only on this device; download a backup." : `<b>Last backup ${days} days ago.</b> Download a new one.`,
    empty: "No data yet. Start by restoring the backup from the old app.",
    emptyBtn: "Restore from backup",
    dailyChart: "Daily spending this month",
  },
  tx: {
    placeholder: "Search: McDonald's, Bolt, Rome, 26…", searchLabel: "Search expenses",
    allPeriod: "All time", all: "All", daily: "Daily life", pending: "Newly added", allCats: "All categories",
    clearFilters: "Clear filters", count: (n: number) => `${n} ${n === 1 ? "transaction" : "transactions"}`, avg: "avg.", top: "Top:",
    noResults: "No results. Try another word or clear the filters.",
    period: "Period", kind: "Type", category: "Category",
    shared: "shared", forOthers: "For someone else", deposit: "Deposit · not counted as spending", yourShare0: "your share 0",
    total: "total", isNew: "New",
  },
  detail: {
    category: "Category", payment: "Payment", plnValue: "In PLN", totalPaid: "Total paid", yourShare: "Your share",
    trip: "Trip", verification: "Verification", type: "Type", depositType: "Deposit · not added to spending totals", note: "Note",
    allAt: (m: string) => `${m} · all expenses`,
  },
  merchant: { title: "Place", empty: "Tap an expense and choose \"all expenses\"." },
  more: {
    title: "More",
    items: {
      para: ["Incoming money and grant", "Everything you brought or received"],
      plan: ["Erasmus plan and money check", "Income, balances, amount left to invest"],
      arkadaslar: ["Friends", "Money sent and received, open balances"],
      ayarlar: ["Settings and backup", "Language, backup download and restore"],
    },
  },
  settings: {
    title: "Settings and backup", language: "Language",
    backupTitle: "Backup",
    backupInfo: "Your data is stored only on this device and is never sent to any server. Download a backup regularly in case you change phones or the browser clears its data.",
    lastBackup: "Last backup", never: "never",
    download: "Download backup (JSON)", restore: "Restore from backup",
    downloaded: "Backup downloaded",
    previewTitle: "Restore this backup?",
    previewCounts: "Records in the backup",
    labels: { expenses: "Expenses", trips: "Trips", inflows: "Incoming money", balances: "Balance records", transfers: "Transfers", sources: "Income sources" },
    exportedAt: "Backup date",
    replaceWarn: "The data on this device will be replaced with the backup. Your current data will first be downloaded automatically as a backup file.",
    confirmRestore: "Yes, restore", restored: (n: number) => `Backup restored · ${n} expenses`,
    statusTitle: "Status", lastEntry: "Last entry", bankCheck: "Bank check", source: "Source", addedLater: "Added later",
    expensesN: (n: number) => `${n} expenses`,
    storage: "Persistent storage", storageOn: "on ✓", storageOff: "not granted by browser",
  },
  errors: {
    readFile: "Could not read the file",
    notJson: "Could not read the file: not a valid JSON backup.",
    notBackup: "This file doesn't look like an Erasmus Wallet backup (no expense list).",
    unknownFormat: (f: string) => `Unknown backup format: ${f}`,
  },
};

export const DICT = { tr, en };
export type Lang = keyof typeof DICT;
export const LANGS: Lang[] = ["tr", "en"];
