# Erasmus Cüzdanı — proje rehberi

Bu dosya Claude Code'un her oturumda okuduğu proje tarifidir. Kullanıcıyla Türkçe konuş.

## Ne yapıyoruz

Erasmus öğrencileri için telefona kurulabilen (PWA), Revolut tarzı bir harcama ve bütçe uygulaması.
Şu an claude.ai üzerinde çalışan bir prototip var: `reference/mevcut-uygulama.html` (yalnızca yerelde; kişisel iz taşıdığı için git'e girmez). Görünüm, ekranlar
ve hesaplama mantığı için **ana referans budur**. Yeni uygulama onunla aynı his ve özellikleri taşımalı,
ama Claude'dan bağımsız, herkesin kendi telefonunda çalışan bir web uygulaması olmalı.

İlk kullanıcı: proje sahibi (bir dönemlik Erasmus). Sonra arkadaşları test edecek.

## Değişmez kurallar

1. **Veriler kullanıcının cihazında kalır.** Sunucu, hesap, bulut veritabanı yok. Depolama: IndexedDB (Dexie).
   Banka dökümleri ve harcamalar hiçbir yere gönderilmez. Analitik yok.
2. **Hiçbir veri kaybolmamalı.** Her şema değişikliği bir Dexie migration'ı ile yapılır. Uygulama
   `navigator.storage.persist()` ister. Ayarlar'da tek tuşla JSON yedek indirme ve geri yükleme olur.
   Son yedekten 14 gün geçtiyse ana sayfada hatırlatma gösterilir.
3. **`data/` klasörü asla git'e girmez.** İçinde kullanıcının gerçek finansal verisi var (`.gitignore`).
   Testlerde yalnızca `fixtures/` içindeki uydurma veriler kullanılır.
4. **Banka dökümü önce gelir, notlar kontrol içindir.** İçe aktarmada kartın çekildiği tutar ve para birimi
   esas alınır; kullanıcı notları sadece eksik (nakit) kalemleri tamamlar.
5. Arayüz dili Türkçe (sonra İngilizce eklenecek; metinleri baştan tek bir sözlük dosyasında tut).

## Teknoloji

- Vite + React + TypeScript
- Dexie (IndexedDB), `dexie-react-hooks`
- Grafikler: Chart.js (`react-chartjs-2`) — prototiptekiyle aynı görünüm
- İkonlar: `lucide-react`
- CSV: PapaParse
- PWA: `vite-plugin-pwa` (manifest, ikon, çevrimdışı çalışma)
- Test: Vitest (hesaplama ve içe aktarma fonksiyonları mutlaka test edilir)
- Yayın: GitHub Pages veya Cloudflare Pages (statik site)

## Veri modeli

Prototipin yedek formatı (`format: "erasmus-cuzdan-v1"`) aynen içe aktarılabilmeli. Alanlar:

**expenses** (harcamalar)
- `d` tarih (YYYY-MM-DD, **işlemin yapıldığı gün**), `desc`, `cat` (kategori), `pay` (ödeme yöntemi)
- `gross` kartından/elinden çıkan toplam, `share` kullanıcının payı, `cur` (PLN/EUR…)
- `trip` gezi id'si (boşsa günlük yaşam), `city`, `note`
- `src`: `bank` | `cash` | `friend` | `note` (doğrulama durumu)
- `kind: "deposit"` → listede görünür ama harcama toplamlarına sayılmaz (ör. yurt depozitosu)
- `share: 0` → başkası için ödenmiş ("Başkası için" etiketi, not satırda görünür)
- `ts` kullanıcı tarafından eklenme/düzenlenme zamanı (banka kontrolünden sonra eklenenleri işaretlemek için)

**trips**: `name, start, end, cities[], with, note, bankNetPLN?`
**inflows** (dışarıdan gelen para): `d, desc, amount, cur, fee, pln?, source, via, to, note`
  - `pln` doluysa gerçekleşen zł karşılığıdır (döviz bürosu); yoksa `(amount - fee)` kurdan çevrilir.
  - Hesaplar arası aktarımlar (Erste → Revolut) giriş değildir.
**sources** (gelir kaynakları): `name, amount, cur, freq ("Aylık" | "Tek seferlik"), note`
**balances** (bakiye kayıtları): `d, revPLN, revEUR, erstePLN, ersteEUR, cashPLN, cashEUR`
  → yeni sürümde hesaplar **dinamik liste** olmalı (kullanıcı kendi bankalarını ekler).
**transfers** (arkadaşlarla para alışverişi): `d, who, acct, amount (+gelen/−giden), cur, why, closed`
**settings**: kurlar, aylık bütçe, Erasmus başlangıç/bitiş, depozito, Türkiye'deki para,
  sabit ödemeler (`fixed[]: name, amount, left, monthly`), `tripBudget`, `shopBudget`, `overrun`, `buffer`, `incomeLeft`
**meta**: `lastEdit, bankCheckedThrough, lastBankCheckAt`

## Hesaplama kuralları (prototipte doğrulandı, aynen koru)

- Kullanıcının harcaması = `share` (EUR ise kurla PLN'ye). Bütçe ve analizler yalnızca bunu kullanır.
- Gezi harcamaları günlük yaşam bütçesine sayılmaz, ayrı gösterilir.
- **Para kontrolü:** gelen para − son bakiye = harcanan; harcanan − kayıtlı harcamalar − depozito = açıklanamayan fark.
  Fark %5'in altındaysa "Kayıtlar tutarlı".
- **Gezi bankayla kontrolü:** kartla ödenenler − arkadaşlardan gelen + arkadaşlara giden + nakit = gezinin net maliyeti;
  kalemlerin `share` toplamıyla eşleşmeli.
- **Plan:** gereken = (aylık bütçe − aylık sabitler) × (1 + aşma payı) × kalan ay + sabit ödemeler (tutar × kalan adet)
  + gezi bütçesi + alışveriş bütçesi + güvenlik payı. Kaynak = Polonya'daki para + kalan aylık gelirler + Türkiye'deki para.
  Yatırıma ayrılabilir = kaynak − gereken.

## İçe aktarma (en önemli yeni özellik)

- **Revolut CSV** (uygulamadan "Statement → Excel/CSV"): sütunlar
  `Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance`.
  **Tarih olarak `Started Date` kullan.** `Completed Date` ve Revolut'un PDF/konsolide dökümleri kart
  harcamalarını çoğu zaman 1 gün sonra gösteriyor (fişlerle doğrulandı).
  `Type`: CARD_PAYMENT → harcama, TOPUP / EXCHANGE / hesaplar arası → yok say, TRANSFER → arkadaş transferi adayı,
  REFUND → ilgili harcamadan düş. `State` = REVERTED/DECLINED olanları alma. Ücretleri (`Fee`) ayrı "Banka & Kur Masrafı" kalemi yap.
- Revolut konsolide dökümü (`consolidated_statement_*.csv`, prototipte kullanılan format) de desteklenebilir.
- **Erste Bank Polska:** önce uygulamanın CSV dışa aktarması varsa onu destekle; PDF okuma sonraki aşama.
- Her içe aktarmada: önizleme ekranı, otomatik kategori önerisi (satıcı adı kuralları), **mükerrer kayıt tespiti**
  (aynı tarih ±1 gün, aynı tutar, benzer açıklama), kullanıcı onayı.
- Kategorizasyon kuralları kullanıcının düzeltmelerinden öğrenilir (satıcı → kategori eşlemesi kaydedilir).

## Kategoriler

Market · Yeme-İçme (dışarıda) · Şehir İçi Ulaşım · Seyahat Ulaşımı · Yurt & Konaklama · Ev & Mutfak · Giyim ·
Kişisel Bakım & Sağlık · Telefon & Abonelik · Çamaşır · Okul & Resmi · Hediyelik & Hatıra · Banka & Kur Masrafı · Diğer

Kategori ile şehir/konum ayrı şeylerdir (ör. tuvalet → "Diğer", şehri "Varşova"). Şehirler arası yolculuklar
şehir alanında "Yolda (şehirler arası)".

## Başkalarına açarken (arkadaş testi)

- Ülke, yerel para birimi (PLN, EUR, CZK, HUF…) ve ev para birimi (TRY) kurulumda seçilir; PLN sabit kodlanmaz.
- Kurlar elle girilebilir; isteğe bağlı olarak anahtarsız ücretsiz bir kaynaktan (ör. frankfurter.app) güncellenir.
- İlk açılışta kısa kurulum: Erasmus tarihleri, şehir, bütçe, hesaplar.
- Uygulama içinde "Geri bildirim gönder" bağlantısı (ör. bir Google Form), kişisel veri içermeden.

## Çalışma şekli

- Her aşamayı küçük adımlarla yap, her adımdan sonra `npm run build` ve `npm test` çalıştır.
- Görsel değişikliklerden sonra mobil genişlikte (390px) kontrol et.
- Kullanıcının verisini etkileyen her değişiklikte önce yedek al, sonra migration yaz, sonra test et.
- Yol haritası ve hazır komutlar: `docs/YOL-HARITASI.md`.
