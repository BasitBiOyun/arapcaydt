# Öğretmen çalışma akışı

Öğretmenler kendi içeriklerini tamamlar. İçerik gönderme veya yönetici inceleme/onay adımı yoktur. Üyelik erişim onayı ayrı olarak korunur. Yönetici kayıtlı soru görselini, çözüm metnini, sesi ve animasyon önizlemesini salt okunur açabilir.

- Editör: Soru → Metin → Ses → İşaretler → İndir. Ön koşulu tamamlanmamış adımlar kapalıdır.
- Değişiklikler 1,2 saniye sonra sırayla kaydedilir. Aynı bekleyen sürüm iki kere gönderilmez. “Kaydedildi” yalnız sunucu yanıtıyla gösterilir.
- Kaydedilmemiş değişiklikler hesaba göre IndexedDB'de yedeklenir. Projeyi aynı cihazda tekrar açınca geri yüklenir. Bu, birden çok cihaz arasında eşzamanlı düzenleme/birleştirme sistemi değildir. Tarayıcı verisi silinirse cihaz yedeği de silinir.
- Ses ön kontrolü eksik şık başlıklarını, belirlenebilen cevap uyuşmazlığını ve karakter sınırını gösterir; çözümün bilimsel doğruluğunu doğrulamaz.
- Kısa telaffuz örneği isteğe bağlıdır ve Gemini ses kotasından bir istek harcar. Asıl ses kaydının yerine geçmez. Video tarayıcıda üretilmeye devam eder.
- Kutular ok tuşlarıyla taşınabilir; Shift daha büyük adım uygular. Geri al önceki kutu/zamanlama planını geri getirir. İşaretler adımında sağ panel her işareti tek satırda gösterir (ör. "B şıkkı elenir · 5,0 sn" ve tetikleyen cümle): *Dinle* işaretten 1,5 sn önceden 3,5 sn çalar; *Erken / Geç* 0,3 sn kaydırır ve hemen yeniden çalar (✗/✓ işaretleri video sonuna kadar görünür kalır); *Kaldır* işareti siler; *Geri al* son değişikliği döndürür. Tam zaman çizelgesi önizlemenin altında "Gelişmiş: zaman çizelgesi" içinde kalır; *İşaretleri yeniden hazırla* elle yapılan zamanlama düzeltmelerini sildiği için önce onay ister (seçili işareti Shift+ok ile 0,2 sn kaydırma, kısayollar).
- Kütüphanede koleksiyon, yıl, kategori, aşama ve metin filtreleri bulunur. Çoğaltma görsel, metin ve tasarım ayarlarını kopyalar; ses ve animasyon yeniden hazırlanır.

## Kontrol

48 otomatik test: erişim kuralları, animasyon regresyonları, sıralı kayıt, hata sonrası kayıt, aynı sürümün tekrarını önleme ve düzenleme sınırları. Vercel için gerçek Node ESM yükleme/anonim erişim testi. TypeScript ve üretim derlemesi. Yerel örnek üzerinden masaüstü/390px mobil görünüm, adımlar ve kütüphane araması kontrol edildi. Ücretli ses denemesi otomatik çağrılmadı. Gerçek e-posta doğrulama ve şifre yenileme teslimatı ayrıca kullanıcı hesabıyla doğrulanmalıdır.


## Yayın kontrolü ve yüklenen MP3

- İşaretler ve İndir adımlarında **Yayın kontrolü** kartı görünür: bulunan şıklar, doğru cevaba tik, metin–cevap uyumu, zamanlama kalitesi, görselde bulunamayan Arapça kelimeler ve animasyon planının güncelliği. Kırmızı madde yayından önce düzeltilmelidir; sarı madde kontrol önerisidir. Her maddenin yanındaki düğme ilgili düzenleyiciyi açar.
- Seslendirme: ana ses motoru Gemini TTS'dir (ücretsiz modeller arasında otomatik geçiş, Achernar sesi); ElevenLabs ses üretmez (yalnız kelime zamanı yedeğidir). Gemini'nin üç modeli de o gün dolduysa öğretmen "Bugünkü ücretsiz ses hakkı doldu…" uyarısını görür. Öğretmen yalnız çözüm metnini yazıp **Seslendirme Oluştur**'a basar; ses ayarı yoktur.
- **Kendi Google anahtarı:** Ayarlar → *Google anahtarım* kartına öğretmen kendi AI Studio anahtarını yapıştırır (aistudio.google.com/apikey → Create API key; faturalandırma açılmaz). Anahtar Google'da doğrulanır, sunucuda AES-256-GCM ile şifreli saklanır (`GEMINI_KEY_ENCRYPTION_SECRET`), tarayıcıya hiç geri gönderilmez ve yalnız o öğretmenin istekleri için kullanılır. Google anahtarı reddederse "geçersiz" işaretlenir ve ortak anahtara geçilir.
- **Sıra:** seslendirme öğretmen anahtarı (3 model, sabit kalite sırası) → ortak anahtar (3 model); ikisi de dolarsa ses üretilmez. Model atlama yalnız Google'ın günlük kota 429'unda yapılır; kayıtta kota türü ve sınırı (ör. `PerDay sınır 100`) tutulur. Kelime zamanı öğretmen Transcribe → ortak Transcribe (öğretmen başına günde 25; yönetici Ayarlar'dan değiştirebilir) → ElevenLabs Forced Alignment (öğretmen başına günde 20; ayarlanabilir, 0 kapatır) → bilgisayarda Whisper. Yöneticilere günlük sınır uygulanmaz. Günlük kotası dolan model (Google'ın gün bazlı 429'u) o anahtar için Pasifik gece yarısına (TR 10:00–11:00) kadar atlanır; dakika bazlı 429'lar bir sonraki istekte yeniden denenir. Ses adımında tek satırla hangi kapasitenin kullanılacağı gösterilir.
- Üretilen seste kelime zamanları sırasıyla Gemini Transcribe → ElevenLabs Forced Alignment → yerel Whisper ile alınır; hiçbiri olmazsa yaklaşık zamanlama kullanılır. ElevenLabs yedeğiyle üretilen seste zamanlar doğrudan ElevenLabs'ten gelir. Hangi motorun/modelin ve zaman kaynağının kullanıldığı öğretmene gösterilmez; yönetim panelinde izlenir.
- Öğretmenin kendi MP3'ü önce projeyle birlikte depoya kaydedilir (25 MB'a kadar), sonra üretilen seslerle aynı sırayla zamanlanır: Gemini Transcribe (öğretmen, sonra ortak anahtar) → ElevenLabs Forced Alignment (yazılı çözüm metni sese hizalanır) → bilgisayarda Whisper. Metni sesten çıkarmak (speech-to-text) gerekmez; öğretmenin okuduğu metin yazdığı çözümle aynı olmalıdır.

## Ayarlar

- **Profilim:** görünen ad ve şifre değişikliği (`update_my_profile`, Supabase Auth). Öğretmen yalnız kendi adını ve tercihlerini değiştirebilir; rol ve onay durumu değişmez.
- **Yeni soru varsayılanları:** kategori, koleksiyon / deneme adı, sınav / yıl ile altyazı açık/kapalı, altyazı konumu ve sondaki "Doğru cevap" kapanış kartı. Yeni soruda ve Toplu Üretim'de bu değerlerle başlanır; her soruda editörden değiştirilebilir (editörde *Kapanış kartı* kutusu).
- **Stüdyo ayarları (yalnız yönetici):** herkesin üstünde görünen duyuru (öğretmen kapatınca o sürüm bir daha gösterilmez), öğretmen başına günlük sınırlar, otomatik onay listesi (satır başına e-posta ya da `@alan.adı`; e-posta doğrulanınca beklemeden onaylanır, engellenen üye açılmaz) ve yeni kayıtları kapatma (sayfada "Hesap oluştur" gizlenir, veritabanı yeni kaydı reddeder; kurucu yönetici adresi hariç).
- Bu ayarlar `supabase/migrations/20261001_settings.sql` çalıştırılınca açılır. Çalıştırılmadan önce kaydet düğmeleri "veritabanı güncellemesi bekleniyor" der; sınırlar 25 / 20, kayıtlar açık kalır, duyuru gösterilmez.

## Toplu üretim

Kenar menüdeki **Toplu Üretim** sayfası bir soru setini tek seferde hazırlar.

- **Görseller:** Dosya adında soru numarası olmalı (`soru_3.png`, `S3.jpg`, `3.png`). Etiketsiz birden çok sayı içeren adlar (`deneme 2026 12.png`) eşleşmez ve listede gösterilir.
- **Çözüm metni:** Tek belge; her soru kendi satırında `Soru 3` (veya `3. Soru`, `## Soru 3`) başlığıyla başlar. Başlık seslendirmede okunur. Metnin içindeki `Soru 1'de …` gibi ifadeler başlık sayılmaz.
- **MP3 (isteğe bağlı):** Aynı adlandırmayla eşleşir ve metne hizalanır. MP3'ü olmayan sorular yalnız kutu işaretliyse Gemini ile seslendirilir; başlamadan önce toplam karakter gösterilip onay istenir. İstekler arasında sunucunun 10 saniye kuralına uyulur.
- **Sıra:** Her soru için proje oluşturma → ses → işaretler → (seçiliyse) MP4 indirme. Her adımdan sonra proje kaydedilir; hata yalnız o soruyu etkiler. Görseli veya metni eksik sorular atlanır. **Durdur** mevcut adımı bitirir, kalanları başlatmaz.
- **Sonuç:** Her satırda yayın kontrolü sonucu (yayına hazır / kontrol önerilir / düzeltme gerekli) ve projeyi editörde açan düğme bulunur.

## Yönetim paneli: ses ve kalite

- **Ses ve zamanlama:** projelerin şu anki ses kaydına göre Gemini / ElevenLabs yedeği / yüklenen MP3 sayıları, Gemini hatası sonrası yedeğe düşen projeler, kullanılan Gemini modelleri, kelime zamanı kaynağı ve ElevenLabs yedek kotası (kalan karakter).
- **Üretim hunisi ve kalite:** proje → sesli → işaretleri hazır → yayına hazır → indirilen MP4; yayın kontrolü sonuçları (hazır / kontrol önerilir / düzeltme gerekli). Kalite, editördeki yayın kontrolünün kayıtlı plan üzerindeki karşılığıdır.
- **Dikkat gerektiren projeler:** Gemini'nin kullanılamadığı, kelime zamanı alınamayan veya düzeltme gereken son projeler; başlığa tıklayınca salt okunur önizleme açılır.
- **Sekmeler:** *Genel bakış* (onay bekleyen hesaplar en üstte, tek tıkla Onayla/Reddet; ana sayılar; dikkat gerektiren projeler; üretim hunisi), *Öğretmenler* (tek tablo: durum, sorular, kalite, Google anahtarı, bugünkü kullanım, son çalışma, erişim), *Kullanım* (ortak kapasite, istek sayaçları, ses ve zamanlama, depolama), *Projeler* (dikkat gerektirenler, soru tipleri, son projeler ve işlemler, eski tarayıcı kayıtları).
- **İstek sayaçları:** her istek ayrı bir işlem kaydıdır: her Gemini seslendirme model denemesi (başarılı/başarısız), her Gemini Transcribe ve ElevenLabs Forced Alignment çağrısı, her ElevenLabs yedek sesi. Bugün (Gemini günlük kotasının sıfırlandığı Pasifik saatine göre), son 30 gün ve toplam; Gemini seslendirme için model başına. Kayıt sunucuda tutulur, sayaç hatası seslendirmeyi hiç engellemez.
- **Google anahtarları ve bugünkü haklar:** anahtarını bağlayan öğretmen sayısı, ortak anahtarın bugünkü zamanlama kullanımı (~100) ve kotası dolan ortak ses modelleri; öğretmen başına anahtar durumu (son 4 karakter), kendi anahtarıyla ses/zamanlama, ortak anahtardan ses/zamanlama (x/25) ve ElevenLabs hizalama (x/20).
- **Depolama:** Supabase kullanımı (ücretsiz plan 1 GB) türlere göre (MP3 ses, eski WAV ses, görsel, kullanılmayan). *WAV sesi MP3'e çevir* eski Gemini WAV seslerini 64 kbps MP3'e çevirir (yaklaşık 6 kat küçük) ve projeyi yeni dosyaya bağlar; kelime zamanları değişmez (LAME kodlayıcı gecikmesi sessiz baştan kırpılır, ffmpeg ve Chromium'da ölçülen kayma 0,00 ms), projenin "son güncelleme" zamanı değişmez. Ardından artık kullanılmayan WAV'lar silinir. *Kullanılmayan dosyaları sil* hiçbir projenin göstermediği dosyaları (yeniden seslendirme, silinen projeler) siler; son 7 gündekiler korunur. Yeni Gemini sesleri doğrudan MP3 kaydedilir (kodlama başarısız olursa WAV).
- **Kurulum:** `supabase/migrations/20260928_teacher_keys.sql` Supabase SQL Editor'da bir kez çalıştırılmalıdır (20260927 dosyasının içeriğini de kapsar; tekrar çalıştırmak zararsızdır). Vercel'de `GEMINI_KEY_ENCRYPTION_SECRET` tanımlanmalıdır. `supabase/migrations/20260929_no_svg_uploads.sql` depolamada SVG yüklemeyi kapatır; `20260930_storage_admin.sql` depolama göstergesi ve MP3 dönüştürme içindir (her biri bir kez çalıştırılır). Çalıştırılana kadar panel bunu uyarı olarak gösterir; sayaçlar ve günlük sınırlar uygulanmaz ama seslendirme çalışmaya devam eder.
- Üye tablosundaki ElevenLabs sütunları yalnız yedek ses isteklerini sayar. Proje bazlı bölümler (ses motoru, modeller, zaman kaynağı) projelerin şu anki ses kaydından hesaplanır. İstatistikler projelerin yalnız gerekli alanlarını okur; ses kelime listesi ve altyazılar indirilmez.

## Çöp kutusu, yedek, toplu işlemler ve yardım

- **Çöp kutusu:** Silinen soru hemen silinmez; `data.deletedAt` ile işaretlenir ve Sorularım → Çöp kutusu sekmesinde 30 gün bekler (veritabanı değişikliği gerekmez). Geri alınabilir ya da kalıcı silinebilir; 30 günü dolanlar öğretmen listeyi açtığında dosyalarıyla birlikte kalıcı silinir. Yönetim panelindeki sayılar çöpteki soruları da içerir.
- **Yedek:** Ayarlar → Yedekleme tek ZIP indirir (`soru-yedegi.json` + görseller + sesler); aynı ZIP ile geri yüklenir. Hesapta zaten olan bir soru değiştirilmez, yedekteki hâli yeni soru olarak eklenir. Sorularım'da seçili sorular için de ZIP alınabilir.
- **Toplu işlemler:** Sorularım'da satırlar seçilip koleksiyona taşınır, yedeklenir veya çöpe atılır; sıralama (son düzenlenen, son/ilk eklenen, soru numarası, ad) cihazda hatırlanır.
- **Toplu üretim:** MP4'ler varsayılan olarak sonunda tek ZIP iner ("Koleksiyon – Soru 05.mp4"); her satırdan tek video da indirilebilir.
- **Yardım:** Sol menüde "Yardım ve rehber" (`#/yardim/<konu>`), konular `src/features/help/helpTopics.ts` içinde. İlk girişte kısa bir tanıtım açılır (cihaz başına bir kez; Yardım'dan tekrar izlenir). Stüdyo ekran görüntüleri örnek verilerle `npm run help:screenshots` ile yeniden çekilir (Playwright gerekir; `PLAYWRIGHT_MODULE` ve `CHROMIUM_PATH` ile kurulu bir kopya gösterilebilir). AI Studio görselleri (`public/help/aistudio-*.webp`) gerçek Google ekranlarından, kişisel bilgiler kapatılarak hazırlanmıştır ve betikle yeniden çekilmez.
