# Yol haritası ve Claude Code'a verilecek komutlar

Her aşamayı ayrı bir Claude Code oturumunda yapabilirsin. Aşama bitince uygulamayı telefonda dene,
beğenmediğin yeri söyle, sonra bir sonrakine geç.

---

## Aşama 1 — Temel: iskelet, veri katmanı, verilerimi taşı

> CLAUDE.md'yi ve `reference/mevcut-uygulama.html` dosyasını oku. Vite + React + TypeScript ile projeyi kur.
> Dexie ile veri katmanını CLAUDE.md'deki modele göre yaz. `data/` içindeki `erasmus-cuzdan-yedek-*.json`
> dosyasını içe aktarabilen bir "Yedekten geri yükle" özelliği ve "Yedek indir" özelliği yap. Ana sayfayı
> ve Hareketler ekranını prototipteki tasarımla birebir kur. Para kontrolü ve plan hesaplarını
> saf fonksiyonlar olarak yaz ve Vitest ile test et: benim yedeğimle "harcanan" ve kayıtlı toplamlar
> prototipteki rakamlarla aynı çıkmalı.

Bitti sayılması için: yedeğim yüklendiğinde 159 harcama görünüyor, İtalya gezisi 1.868,63 zł, testler geçiyor.

## Aşama 2 — Tüm ekranlar

> Prototipteki Analiz, Geziler (gezi içi arama dahil), Para (hibe, gelen paralar), Plan ve kontrol,
> Arkadaşlar, Ayarlar ekranlarını ekle. Harcama ekleme/düzenleme sayfası, kategori/dönem seçicileri
> ve mağaza renkli avatarları prototipteki gibi olsun. Açık/koyu tema.

## Aşama 3 — Banka dökümü içe aktarma

> Revolut CSV içe aktarmayı CLAUDE.md'deki kurallara göre yaz: önizleme, otomatik kategori, mükerrer tespiti,
> onay. `fixtures/revolut-ornek.csv` ile testler yaz. Kategori düzeltmelerimi satıcı kuralı olarak kaydet.
> Sonra Erste için CSV dışa aktarma formatını birlikte inceleyelim.

## Aşama 4 — Telefona kurulabilir hale getir ve yayınla

> vite-plugin-pwa ile manifest, ikonlar ve çevrimdışı çalışmayı ekle. `navigator.storage.persist()` iste,
> yedek hatırlatmasını ekle. GitHub Pages'e otomatik yayın için GitHub Actions kur ve bana adım adım
> GitHub'da yapmam gerekenleri anlat.

Kendi verilerini taşıma: claude.ai'deki eski uygulamadan Ayarlar → "Tam yedek (JSON)" ile güncel yedeği indir,
yeni uygulamada "Yedekten geri yükle" ile yükle. İki uygulamayı bir süre paralel kullanıp rakamları karşılaştır.

## Aşama 5 — Arkadaş testi

> İlk açılış kurulumunu (ülke, para birimleri, tarihler, bütçe, hesaplar) ekle; PLN'yi sabit koddan çıkar.
> Kişisel verilerimi içeren hiçbir varsayılan kalmasın. Geri bildirim bağlantısı ekle. İngilizce dil desteği ekle.

Test: 3–5 arkadaşa linki gönder, telefonda "Ana ekrana ekle" ile kurmalarını iste, bir hafta sonra geri bildirim topla.

---

## Faydalı notlar

- Revolut CSV indirme: Revolut uygulaması → hesap → ⋯ → Statement → Excel → tarih aralığı.
- iPhone'da Safari, uzun süre açılmayan sitelerin verisini silebilir; bu yüzden yedek hatırlatması önemli.
- `data/` klasöründeki gerçek yedek dosyasını kimseyle paylaşma, git'e ekleme.
