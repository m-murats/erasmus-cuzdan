# Erasmus Cüzdanı

Erasmus öğrencileri için, verileri yalnızca kendi telefonunda tutan harcama ve bütçe uygulaması.

- `CLAUDE.md` — proje tarifi (Claude Code bunu her oturumda okur)
- `docs/YOL-HARITASI.md` — aşamalar ve Claude Code'a verilecek hazır komutlar
- `reference/mevcut-uygulama.html` — claude.ai'deki prototip (tasarım ve hesaplama referansı; yalnızca yerelde, git'e girmez)
- `fixtures/` — testler için uydurma örnek veriler
- `data/` — senin gerçek yedeğin (git'e girmez, kimseyle paylaşma)

## Yayın (GitHub Pages)

`main` dalına her gönderimde `.github/workflows/yayin.yml` çalışır: testler → derleme → yayın.
Testler geçmezse site güncellenmez. İlk kurulumda GitHub'da bir kez **Settings → Pages → Source: GitHub Actions** seçilmeli.

## Telefona kurma

- **iPhone (Safari):** siteyi aç → Paylaş → **Ana Ekrana Ekle**
- **Android (Chrome):** siteyi aç → ⋮ menü → **Uygulamayı yükle**

Kurulduktan sonra internetsiz de açılır. Veriler yalnızca o telefonda saklanır; Ayarlar'dan düzenli yedek indir.
Yeni sürüm yayınlanınca uygulamanın altında "Yeni sürüm hazır · Yenile" çıkar.
