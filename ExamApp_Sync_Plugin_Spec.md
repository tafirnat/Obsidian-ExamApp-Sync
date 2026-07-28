# Proje Kapsam Metni: ExamApp Gist Sync Plugin

## 1. Projenin Amacı ve Vizyonu
Bu projenin amacı, Obsidian kullanıcılarının yerel (local) Vault'larında tuttukları soru bankası verilerini (JSON formunda), dışarıdan hiçbir aracı script (Python, CLI vb.) veya AI kullanmadan doğrudan **GitHub Gist API** üzerinden **ExamApp** uygulamasıyla çift yönlü (Pull/Push) senkronize edebilecekleri bağımsız bir **Obsidian Topluluk Eklentisi (Community Plugin)** geliştirmektir.

## 2. Hangi Sorunu Çözüyor?
Mevcut durumda, Obsidian'da üretilen test sorularının ExamApp'e aktarılması manuel kopyalama/yapıştırma ya da harici Python betiklerinin çalıştırılmasına bağımlıdır. Bu durum kullanıcının akıcılığını bozar, bilişsel yük (cognitive load) yaratır ve odaklanmayı zorlaştırır. Bu eklenti, veri senkronizasyonunu Obsidian arayüzünde tek bir butona (Ribbon Icon) indirgeyerek sürtünmesiz bir deneyim sunar.

## 3. Beklenen Özellikler ve Mimari Gereksinimler
- **Sıfır Dış Bağımlılık (Zero External Dependency):** Eklenti saf TypeScript tabanlı olmalı; arka planda Python, Node.js shell komutları veya harici AI süreçleri çalıştırmamalıdır. İletişim tamamen Obsidian'ın yerleşik JavaScript `fetch` veya `requestUrl` modülleri ile sağlanmalıdır.
- **Ribbon (Sol Dikey Panel) Entegrasyonu:** Obsidian arayüzünün sol barına tıklanabilir minimalist bir "Sync" butonu eklenecektir.
- **Gelişmiş Ayarlar Menüsü (Settings Tab):**
  - `GitHub Personal Access Token (PAT)` (Secret/Password input formatında)
  - `Gist ID` (ExamApp verilerinin tutulduğu hedef Gist'in ID'si)
  - `Yerel Dosya Yolu` (Örn: `50_Projects/ExamApp/data/local_pool.json`)
- **Çift Yönlü Senkronizasyon (Pull & Push):**
  - **Pull (Çek):** Gist'teki güncel veriyi okuyup yerel dosyaya yazar (üzerine yazar veya merge eder).
  - **Push (Gönder):** Yerel dosyadaki veriyi alıp `PATCH /gists/{gist_id}` yöntemiyle Gist'e günceller.
- **Açık Kaynak Standartları:** Proje, standart Obsidian Plugin şablonuna (`manifest.json`, `main.ts`, `styles.css`) uygun geliştirilecek olup resmi topluluk havuzunda paylaşılmaya hazır olacaktır.

## 4. Kullanıcı Deneyimi Senaryosu (User Flow)
1. Kullanıcı Obsidian ayarlarına girip "ExamApp Sync" eklentisini aktif eder ve token/ID bilgilerini kaydeder.
2. Obsidian'da testleri çözer veya yeni soruları JSON'a ekler.
3. İşlemi bitince sol paneldeki (Ribbon) ExamApp butonuna tıklar.
4. Açılan küçük menüden "Gist'e Gönder (Push)" seçeneğini seçer.
5. İşlem bitince sağ üstte Obsidian standart bildirimi (Toast) belirir: *"✅ ExamApp: Senkronizasyon Başarılı"*.

## 5. ExamApp Mimari Bağlamı ve Veri Modeli Uyumluluğu
Bu eklentinin ExamApp ile kusursuz çalışabilmesi ve veri bütünlüğünü bozmaması için aşağıdaki mimari kurallara ve JSON şemasına harfiyen uyması gerekmektedir:

### 5.1. Gist Payload Yapısı (`exam_app_backup.json`)
ExamApp, Gist üzerinde tüm kullanıcı verisini tek bir JSON dosyasında (`exam_app_backup.json`) tutar. Ana obje yapısı şu şekildedir:
- `version` (Number)
- `lastUpdated` (Timestamp)
- `sources` (Array): Soru havuzlarının bulunduğu dizi.
- `deletedSourceIds` (Array): Silinmiş havuzların kimlikleri (Tombstone pattern).
- `stats`, `totalStats`, `recentTests`, `settings`: ExamApp'in kendi istatistik ve ayar verileri.

**Push (Gönder) Stratejisi (ÇOK ÖNEMLİ):**
Eklenti, Obsidian'dan Gist'e veri yollarken (Push) **asla tüm dosyayı sıfırdan oluşturmamalıdır**. 
1. Önce Gist'ten mevcut `exam_app_backup.json` dosyası çekilmeli (Pull).
2. Obsidian'daki yerel soru verileri `sources` dizisine uygun şekilde entegre edilmeli (Var olan source ID'leri güncellenmeli, yeniler eklenmeli).
3. `stats`, `recentTests`, `deletedSourceIds` ve `settings` gibi kullanıcının sınav geçmişini ve ayarlarını içeren diğer anahtarlar (keys) **kesinlikle korunmalıdır**. Sadece `lastUpdated` timestamp'i güncellenmelidir.
4. Son olarak güncellenmiş bütüncül JSON nesnesi `PATCH` metodu ile Gist'e geri gönderilmelidir.

### 5.2. Soru Şeması (Schema) Kuralları
ExamApp, içe aktarılan her soruyu katı bir şema doğrulamasından (`validateExamSchema`) geçirir. Hata almamak için Obsidian'da oluşturulan sorular JSON'a dönüştürülürken şu kurallara uymalıdır:
- Her source (soru havuzu) eşsiz bir `id`'ye (tercihen UUID) ve `name` alanına sahip olmalıdır.
- Her sorunun eşsiz bir `id` değeri olmalıdır.
- Her soruda `type` alanı bulunmalıdır. (Geçerli türler: `single_choice`, `multiple_choice`, `true_false`, `text_input`, `text`, `open_ended`, `fill_in_the_blank`, `flashcard`).
- Soru metni `text` veya `content.text` olarak sağlanmalıdır.
- Çoktan seçmeli türler için en az 2 elemanlı `options` dizisi bulunmalıdır.
- Doğru cevaplar `answer` objesi içinde tanımlanmalıdır (Örn: `answer.correct_ids` veya `answer.accepted_texts`). Flashcard'lar için ise en azından `answer.back` alanı bulunmalıdır.

### 5.3. Silinmiş Kaynaklar (Tombstone Pattern)
ExamApp, kullanıcı uygulamadan bir soru paketini sildiğinde bunun ID'sini `deletedSourceIds` dizisine ekler. Eklenti, Gist'ten Pull yaparken veya Push yaparken bu listeyi kontrol etmeli ve `deletedSourceIds` içinde bulunan bir kaynak ID'sini tekrar `sources` içine **eklememelidir** (Zombie Data probleminden kaçınmak için).

---
> **Not:** Bu belge, gelecekte bir AI asistanına *"Bu özelliklerde bir Obsidian eklentisi geliştirelim, işte projenin kapsamı"* denildiğinde, sistemin hedefi, amacı ve sınırları %100 net algılaması için "Single Source of Truth" (Tek Doğru Kaynağı) olarak hazırlanmıştır.
