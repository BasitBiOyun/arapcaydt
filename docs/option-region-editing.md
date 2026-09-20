# Şık taraması ve elle düzeltme

Şık kutuları için Arapça/Türkçe/İngilizce metin taramasına ek olarak İngilizce seyrek metin taraması çalışır. İkinci taramanın yalnızca A–E etiket koordinatları alınır; Arapça kelimeler ilk taramadan korunur. Şıklar komşu etiket sınırı ve satırdaki boşluklarla ayrılır. Bu işlem tarayıcıda gerçekleşir; ek ücretli API çağrısı yoktur.

ElevenLabs kelime zamanları, anlatımdaki olayların zaman çizelgesine yerleştirilmesinde zaten kullanılır. Bu zamanlar resimdeki koordinatları içermez. Koordinatlar OCR'dan veya hocanın çizdiği alanlardan gelir. Düşük kaliteli görsellerde otomatik tanıma hatasız garanti edilmez; eksik şıklar önizlemede belirtilir.

## Mevcut projeyi düzeltme

1. Projeyi kaydedin ve güncel sayfayı açın. Mevcut sesi koruyarak **Yeniden Oluştur** seçin. Sesi yeniden üretmeniz gerekmez.
2. **Kutuları ve vurguları düzenle** bölümünde çizilecek şıkkı seçip **Yeni kutu çiz** deyin. Aynı şık için çizilen kutu eskisinin yerine geçer.
3. Kelime vurgusu için **Çözüm metninden kelime / ifade seç** bölümünde metni seçin, **Seçili ifadeye kutu çiz** deyin ve görselde alanı çizin. Vurgu ve alt çizgi, ifadenin ses zamanına otomatik bağlanır.
4. Kutular taşınabilir, sağ alt köşeden veya yüzde alanlarından boyutlandırılabilir. Açılır listeden seçilen kutu silinebilir. Silmek ilgili animasyonları da kaldırır.
5. Yeni şık kutuları anlatımdaki odaklanma, eleme ve doğru cevap olaylarına hemen bağlanır. Koordinat düzeltmeleri mevcut zamanları korur. Yeniden üretim elle düzeltilen alanları ve silme tercihlerini korur; görsel değişince bunlar sıfırlanır.
6. Önizlemeyi kontrol edip kaydedin ve MP4'ü indirin. İfade metinde yoksa veya anlam çıkarılamazsa **İşaretlerin zamanlamasını düzenle** bölümünden adım eklenebilir.

## Doğrulama

`npm test`, `npm run lint`, `npm run build`.

Gerçek Soru 2 OCR kaydı tests/fixtures/soru2-ocr.json dosyasındadır. Karışık dil taramasındaki D etiketi `(نا` olarak okunurken bağımsız Latin taraması `D)` bulur. Regresyon testleri iki sütunun ayrılmasını, eksik etiketin komşu kutuyu büyütmemesini, RTL satır sırasını, yeni kutuların sesle eşleşmesini, silme ve yeniden üretim davranışını kapsar.
