# Soru videosu: tarayıcıda üretim

## Akış

Editör beş adımdır: **Soru → Metin → Ses → İşaretler → İndir**. Ön koşulu tamamlanmamış adım kapalıdır.

1. **Soru:** Soru görseli yüklenir. Görsel, videoda özgün tasarımıyla kalır.
2. **Metin:** Çözüm metni harekeli yazılır, doğru cevap seçilir. Ses ön kontrolü eksik şıkları, cevap uyuşmazlığını ve karakter sınırını gösterir.
3. **Ses:** Ses Google Gemini ile üretilir (`api/gemini/generate.ts`). Uzun metin bölümlere ayrılıp birleştirilir (`api/gemini/join-parts.ts`). Kelime zamanları önce Gemini Transcribe ile alınır, olmazsa ElevenLabs Forced Alignment yedek olarak kullanılır. ElevenLabs ses üretmez. Öğretmen kendi MP3'ünü de yükleyebilir. Seslendirme sırasında adımlar ve geçen süre gösterilir. Tek cümle hatalıysa Ses şeridinden yalnız o yer yeniden seslendirilir.
4. **İşaretler:** **İşaretleri hazırla**, görseli tarayıcıda okur (`src/services/ocr/`, iki Tesseract modeli; gerekirse Google Vision). Ardından çözüm metnini şıklara bağlar ve kelime zamanlarına hizalar (`src/services/analysis/`). Kutular ve işaretler görselde ya da zaman şeridinde sürüklenerek düzeltilir. Elle yapılan düzeltmeler yeniden hazırlamada korunur. İşaretler yanlış çıktıysa **Teşhis dosyasını indir** ile dosya alınır. Düzeltme sonrası bu dosya `npm run teshis:ekle` ile teste eklenir.
5. **İndir:** MP4 (1920×1080, 30 fps, H.264 + AAC) tarayıcıda WebCodecs ile kare kare kodlanır (`src/features/video/`). Ücretli video servisi kullanılmaz. Önizleme ve dışa aktarma aynı çizim kodunu kullanır.

## Tarayıcı

Güncel masaüstü Chrome veya Edge hedeflenir. Stüdyo açılırken tarayıcının H.264/AAC kodlayıp kodlayamadığını denetler. Kodlayamıyorsa (ör. bazı Safari ve iPad sürümleri) en başta uyarır. Kodlama sırasında sekme açık tutulmalıdır.

## Doğrulama

`npm ci`, `npm run lint`, `npm test`, `npm run build`. Aynı kontroller GitHub'da `main`'e her gönderimde otomatik çalışır (`.github/workflows/ci.yml`).

Testler gerçek OCR koordinatları, ses zamanları ve öğretmenlerin teşhis dosyalarıyla işaret yerleşimini denetler. Ücretli servisler (Gemini, ElevenLabs, Vision) testlerde çağrılmaz.

## Sınırlar

- Gemini sesi aynı metni her seferinde biraz farklı okuyabilir. Telaffuz sözlüğü yalnız tekrar eden kelimeleri düzeltir.
- OCR her görseli kusursuz okuyamaz. Eksik kutular elle çizilebilir.
