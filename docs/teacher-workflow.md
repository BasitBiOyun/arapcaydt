# Öğretmen çalışma akışı

Öğretmenler kendi içeriklerini tamamlar. İçerik gönderme veya yönetici inceleme/onay adımı yoktur. Üyelik erişim onayı ayrı olarak korunur. Yönetici kayıtlı soru görselini, çözüm metnini, sesi ve animasyon önizlemesini salt okunur açabilir.

- Editör: Soru → Metin → Ses → İşaretler → İndir. Ön koşulu tamamlanmamış adımlar kapalıdır.
- Değişiklikler 1,2 saniye sonra sırayla kaydedilir. Aynı bekleyen sürüm iki kere gönderilmez. “Kaydedildi” yalnız sunucu yanıtıyla gösterilir.
- Kaydedilmemiş değişiklikler hesaba göre IndexedDB'de yedeklenir. Projeyi aynı cihazda tekrar açınca geri yüklenir. Bu, birden çok cihaz arasında eşzamanlı düzenleme/birleştirme sistemi değildir. Tarayıcı verisi silinirse cihaz yedeği de silinir.
- Ses ön kontrolü eksik şık başlıklarını, belirlenebilen cevap uyuşmazlığını ve karakter sınırını gösterir; çözümün bilimsel doğruluğunu doğrulamaz.
- Kısa telaffuz örneği isteğe bağlıdır ve ElevenLabs kotası tüketir. Asıl ses kaydının yerine geçmez. Video tarayıcıda üretilmeye devam eder.
- Kutular ok tuşlarıyla taşınabilir; Shift daha büyük adım uygular. Geri al önceki kutu/zamanlama planını geri getirir. Zamanlama panelinde seçili işareti 0,2 saniye kaydırma ve ilgili anı dinleme vardır.
- Kütüphanede koleksiyon, yıl, kategori, aşama ve metin filtreleri bulunur. Çoğaltma görsel, metin ve tasarım ayarlarını kopyalar; ses ve animasyon yeniden hazırlanır.

## Kontrol

48 otomatik test: erişim kuralları, animasyon regresyonları, sıralı kayıt, hata sonrası kayıt, aynı sürümün tekrarını önleme ve düzenleme sınırları. Vercel için gerçek Node ESM yükleme/anonim erişim testi. TypeScript ve üretim derlemesi. Yerel örnek üzerinden masaüstü/390px mobil görünüm, adımlar ve kütüphane araması kontrol edildi. Ücretli ses denemesi otomatik çağrılmadı. Gerçek e-posta doğrulama ve şifre yenileme teslimatı ayrıca kullanıcı hesabıyla doğrulanmalıdır.


## Yayın kontrolü ve yüklenen MP3

- İşaretler ve İndir adımlarında **Yayın kontrolü** kartı görünür: bulunan şıklar, doğru cevaba tik, metin–cevap uyumu, zamanlama kalitesi, görselde bulunamayan Arapça kelimeler ve animasyon planının güncelliği. Kırmızı madde yayından önce düzeltilmelidir; sarı madde kontrol önerisidir. Her maddenin yanındaki düğme ilgili düzenleyiciyi açar.
- Seslendirme: ana ses motoru Gemini TTS'dir (ücretsiz modeller arasında otomatik geçiş, Achernar sesi); Gemini kullanılamazsa ElevenLabs otomatik yedek olarak devreye girer. Öğretmen yalnız çözüm metnini yazıp **Seslendirme Oluştur**'a basar; ses ayarı yoktur.
- **Kendi Google anahtarı:** Ayarlar → *Google anahtarım* kartına öğretmen kendi AI Studio anahtarını yapıştırır (aistudio.google.com/apikey → Create API key; faturalandırma açılmaz). Anahtar Google'da doğrulanır, sunucuda AES-256-GCM ile şifreli saklanır (`GEMINI_KEY_ENCRYPTION_SECRET`), tarayıcıya hiç geri gönderilmez ve yalnız o öğretmenin istekleri için kullanılır. Google anahtarı reddederse "geçersiz" işaretlenir ve ortak anahtara geçilir.
- **Sıra:** seslendirme öğretmen anahtarı (4 model) → ortak anahtar (4 model) → ElevenLabs sesi. Kelime zamanı öğretmen Transcribe → ortak Transcribe (öğretmen başına günde 25) → ElevenLabs Forced Alignment (öğretmen başına günde 20) → bilgisayarda Whisper. Yöneticilere günlük sınır uygulanmaz. Günlük kotası dolan model (Google'ın gün bazlı 429'u) o anahtar için Pasifik gece yarısına (TR 10:00–11:00) kadar atlanır; dakika bazlı 429'lar bir sonraki istekte yeniden denenir. Ses adımında tek satırla hangi kapasitenin kullanılacağı gösterilir.
- Üretilen seste kelime zamanları sırasıyla Gemini Transcribe → ElevenLabs Forced Alignment → yerel Whisper ile alınır; hiçbiri olmazsa yaklaşık zamanlama kullanılır. ElevenLabs yedeğiyle üretilen seste zamanlar doğrudan ElevenLabs'ten gelir. Hangi motorun/modelin ve zaman kaynağının kullanıldığı öğretmene gösterilmez; yönetim panelinde izlenir.
- Öğretmenin kendi MP3'ü yüklendiğinde yazılı çözüm metni sese sunucuda hizalanır (ElevenLabs forced alignment, `api/elevenlabs/align.ts`). Bu istek ses kullanım sınırına sayılır; yönetici panelinde "Ses hizalama" olarak görünür ve üretilen ses sayısına eklenmez. 3 MB'den büyük dosyalar, hizalama hatası veya boş metin durumunda tarayıcıdaki Whisper ile tahmin edilir ve öğretmene not gösterilir.

## Toplu üretim

Kenar menüdeki **Toplu Üretim** sayfası bir soru setini tek seferde hazırlar.

- **Görseller:** Dosya adında soru numarası olmalı (`soru_3.png`, `S3.jpg`, `3.png`). Etiketsiz birden çok sayı içeren adlar (`deneme 2026 12.png`) eşleşmez ve listede gösterilir.
- **Çözüm metni:** Tek belge; her soru kendi satırında `Soru 3` (veya `3. Soru`, `## Soru 3`) başlığıyla başlar. Başlık seslendirmede okunur. Metnin içindeki `Soru 1'de …` gibi ifadeler başlık sayılmaz.
- **MP3 (isteğe bağlı):** Aynı adlandırmayla eşleşir ve metne hizalanır. MP3'ü olmayan sorular yalnız kutu işaretliyse ElevenLabs ile seslendirilir; başlamadan önce toplam karakter gösterilip onay istenir. İstekler arasında sunucunun 10 saniye kuralına uyulur.
- **Sıra:** Her soru için proje oluşturma → ses → işaretler → (seçiliyse) MP4 indirme. Her adımdan sonra proje kaydedilir; hata yalnız o soruyu etkiler. Görseli veya metni eksik sorular atlanır. **Durdur** mevcut adımı bitirir, kalanları başlatmaz.
- **Sonuç:** Her satırda yayın kontrolü sonucu (yayına hazır / kontrol önerilir / düzeltme gerekli) ve projeyi editörde açan düğme bulunur.

## Yönetim paneli: ses ve kalite

- **Ses ve zamanlama:** projelerin şu anki ses kaydına göre Gemini / ElevenLabs yedeği / yüklenen MP3 sayıları, Gemini hatası sonrası yedeğe düşen projeler, kullanılan Gemini modelleri, kelime zamanı kaynağı ve ElevenLabs yedek kotası (kalan karakter).
- **Üretim hunisi ve kalite:** proje → sesli → işaretleri hazır → yayına hazır → indirilen MP4; yayın kontrolü sonuçları (hazır / kontrol önerilir / düzeltme gerekli). Kalite, editördeki yayın kontrolünün kayıtlı plan üzerindeki karşılığıdır.
- **Dikkat gerektiren projeler:** Gemini'nin kullanılamadığı, kelime zamanı alınamayan veya düzeltme gereken son projeler; başlığa tıklayınca salt okunur önizleme açılır.
- **İstek sayaçları:** her istek ayrı bir işlem kaydıdır: her Gemini seslendirme model denemesi (başarılı/başarısız), her Gemini Transcribe ve ElevenLabs Forced Alignment çağrısı, her ElevenLabs yedek sesi. Bugün (Gemini günlük kotasının sıfırlandığı Pasifik saatine göre), son 30 gün ve toplam; Gemini seslendirme için model başına. Kayıt sunucuda tutulur, sayaç hatası seslendirmeyi hiç engellemez.
- **Google anahtarları ve bugünkü haklar:** anahtarını bağlayan öğretmen sayısı, ortak anahtarın bugünkü zamanlama kullanımı (~100) ve kotası dolan ortak ses modelleri; öğretmen başına anahtar durumu (son 4 karakter), kendi anahtarıyla ses/zamanlama, ortak anahtardan ses/zamanlama (x/25) ve ElevenLabs hizalama (x/20).
- **Kurulum:** `supabase/migrations/20260928_teacher_keys.sql` Supabase SQL Editor'da bir kez çalıştırılmalıdır (20260927 dosyasının içeriğini de kapsar; tekrar çalıştırmak zararsızdır). Vercel'de `GEMINI_KEY_ENCRYPTION_SECRET` tanımlanmalıdır. Çalıştırılana kadar panel bunu uyarı olarak gösterir; sayaçlar ve günlük sınırlar uygulanmaz ama seslendirme çalışmaya devam eder.
- Üye tablosundaki ElevenLabs sütunları yalnız yedek ses isteklerini sayar. Proje bazlı bölümler (ses motoru, modeller, zaman kaynağı) projelerin şu anki ses kaydından hesaplanır. İstatistikler projelerin yalnız gerekli alanlarını okur; ses kelime listesi ve altyazılar indirilmez.
