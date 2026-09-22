# Vurgu ve ses kontrolü

- Soru okunurken her fiziksel satırın alt çizgisi kendi ses aralığında sağdan sola ilerler. Açıklamada yeniden söylenen kısa ifadeler ayrı zamanlanır; aynı cümle içinde üst üste kısa/uzun vurgular oluşturulmaz.
- Şıklar sarı kutuyla incelenir; yanlışlarda kırmızı çarpı, doğruda yeşil kutu ve tik gösterilir. Şık metnine ek alt çizgi üretilmez.
- Çarpı boyutu 1080p'de sabittir. İşaret yüksekliği OCR ile bulunan A–E harfinin merkezinden alınır; Arapça harflerin kuyrukları işareti aşağı çekmez.
- Soru kökü ayrıca yalnız Arapça modelle taranır. Her ifade için iki taramadan daha çok kelime eşleştiren sonuç seçilir. Okunamayan kelimelerde koordinat uydurulmaz; düzenleme için uyarı gösterilir.
- Önceden hazırlanmış projelerde mevcut sesi koruyup videoyu yeniden hazırlayın. Eski MP4 dosyasının görüntüsü kendiliğinden değişmez.

## Türkçe şık adları

`Be şıkkı`, `Ce şıkkına bakalım`, `De seçeneği` yazımları B/C/D olarak tanınır; sesin zaman damgalarıyla eşleştirilir. E için kısa, kesik bir etiket yerine `Şimdi E seçeneğini inceleyelim.` gibi tam cümle deneyin. Bunlar modelin okuyuşunu yönlendiren metin seçenekleridir; istenen vurgu/ünlü uzunluğunu garanti etmez. Önce kısa örnek dinlenmeli, ardından uzun ses üretilmelidir. Var olan MP3'ün telaffuzu animasyon düzenlemesiyle değişmez.

ElevenLabs Multilingual v2 için telaffuz sözlüğünde alias/yazım değişimi kullanılabilir: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries

## Doğrulama

`tests/phrasePlayback.test.ts`: gerçek Soru 4 OCR tekrar kaydı, atlanan ikinci kelime, cümle/kelime çakışması, tekrar edilen ifadeler, satır zamanları, sabit çarpı boyutu, Latin harfine hizalama, şıkta tek vurgu ve Türkçe harf adları.
