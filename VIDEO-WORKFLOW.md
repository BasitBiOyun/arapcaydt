# Soru videosu: tarayıcıda üretim

## Kullanım

1. Soru görselini ve o sesle aynı çözüm metnini açın.
2. Mevcut MP3'ü kullanın veya ElevenLabs'ten ses oluşturup onaylayın.
3. **Videoyu oluştur** düğmesine basın. Önceden hazırlanmış sorularda **Yeniden Oluştur** ile eski animasyon planını yenileyin. Bu işlem yeniden ses üretmez.
4. Önizlemede **Kutuları ve vurguları düzenle** bölümünden alanları sürükleyip boyutlandırın. **İşaretlerin zamanlamasını düzenle** bölümünden saniyeleri ayarlayın. Eksik şıkları görsel üzerinde çizebilirsiniz.
5. Altyazı konumunu ayarlayın; **Kaydet** ile proje değişikliklerini saklayın.
6. **MP4 İndir (1080p)** düğmesi H.264 video ve AAC sesi tarayıcıda birleştirir. Ücretli video üretim servisine istek atılmaz. İptal düğmesi devam eden kodlamayı durdurur.

Güncel masaüstü Chrome/Edge ve HTTPS (yerel geliştirmede localhost) hedeflenir. H.264/AAC desteği çalışma anında kontrol edilir. Destek yoksa veya ses yüklenemiyorsa açık hata verilir; sessiz çıktı veya MP4 adıyla WebM kaydedilmez. Üretim sırasında sayfayı açık tutun.

## Neler düzeldi?

- Tek sütun ve A/B–C/D–E düzeni, gerçek OCR kutularıyla işlenir. Bütün satırı kapsayan asgari genişlik kaldırıldı.
- Arapça kelimeler satır içinde RTL sırasına alınır; hareke, bidi işaretleri ve noktalama eşleştirmeyi bozmaz. Satıra bölünen ifadeler ayrı alanlarla vurgulanır.
- Çözümün tamamı ses kelimeleriyle sıralı eşleştirilir. Tekrarlanan ifadeler kendi cümlesine bağlı kalır. “Olmaz” ve “tam olarak uygundur” değerlendirmeleri tanınır.
- Şık kutusu açıklama boyunca kalır; çarpı yazının dışında, tik doğru cevabın yanında görünür. Altyazıda OCR/Whisper metni yerine özgün çözüm metni kullanılır.
- Önizleme ve dışa aktarma aynı çizim işlevini kullanır. Slayda ek başlık/çerçeve uygulanmaz.
- MP4, ekranı gerçek zamanlı kaydetmek yerine numaralı kareler ve ses örnekleriyle kodlanır. Önizlemeyi sesin saati yönetir.
- Elle değiştirilen bölgeler yeniden hazırlamada korunur. Eksik seçenekler ve yaklaşık ses zamanlaması panelde belirtilir.

## Doğrulama

`npm ci`, `npm run lint`, `npm test`, `npm run build`.

Regresyon testleri gerçek Konak OCR koordinatlarını ve 127.555875 saniyelik sesin yerel Whisper zamanlarını içerir. Tek/iki sütun, satır taşması, tekrar eden ifadeler, eleme anı, özgün Arapça altyazı, işaret geometrisi, geri sarma ve çıktı boyutları kontrol edilir.

Konak sorusuyla tarayıcı doğrulaması: 1920×1080, 30 fps H.264 + AAC; 3827 kare. Windows Edge üzerinde yaklaşık 28 saniyede 19.3 MB MP4 üretildi (hız donanıma bağlıdır). Panelde oynatma, kutu düzenleme arayüzü ve elle düzeltilen bölgenin yeniden hazırlamada korunması kontrol edildi. Bu testte gerçek Tesseract çıktısı tekrar kullanıldı; ElevenLabs çağrılmadı.

## Sınırlar

- ElevenLabs kelime zamanları en iyi eşleşmeyi sağlar. Karışık Türkçe/Arapça MP3 transkripsiyonunda bazı kelimeler komşu zamanlardan hesaplanır; önizleme kontrolü gerekir. OCR her görseli kusursuz okuyamaz; eksik alanlar elle düzeltilebilir.
- Bu değişiklik giriş/depolama mimarisini yenilemez. Mevcut giriş ekranı tarayıcıda örnek kullanıcı doğrulaması yapıyor; gerçek sunucu tarafı yetkilendirme değildir. Çok öğretmenli açık yayından önce bu ayrı konu çözülmelidir.
- Remotion dosyaları mevcut projede korunmuştur; ana editörün bu dışa aktarım yolu Canvas/WebCodecs/mp4-muxer kullanır.

## Yayına alma

PR birleştirilince bağlı Vercel projesinin normal dağıtımı çalışmalıdır. Öğretmenler sayfayı yenileyip mevcut soruda **Yeniden Oluştur** düğmesine basmalıdır. Yeni bir ElevenLabs anahtarı, model veya ücretli render servisi gerekmez.

Yerelde geliştirme için `npm ci` ve `npm run dev`; mevcut uygulama süreci varsa yeni kodla yeniden başlatın.

