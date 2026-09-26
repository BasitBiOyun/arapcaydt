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

## Soru tipleri ve görünüm (pipeline 5)

- Bir cümlede birden çok şık değerlendirilebilir: `A ve B seçenekleri uymaz`, `A, B, D ve E şıkları yanlıştır`, `Doğru cevap C şıkkıdır, çünkü A şıkkı olmaz`. Her şık kendi cümleciğindeki hükümle işaretlenir; gruptaki çarpılar sırayla çizilir.
- `Diğer şıklar / diğer seçenekler / diğerleri … olmaz` doğru cevap dışındaki açık şıkları eler. Sesle söylenen doğru cevap hiçbir zaman çarpılanmaz.
- `Cevap C.`, `Cevabımız D`, `B'yi eliyoruz`, `C'de ise … uygundur` tanınır. `Şimdi de şıklara bakalım` D şıkkı sayılmaz; `I, III` gibi Roma rakamları şık değildir. Dört şıklı (LGS) sorularda yalnız görselde bulunan şıklar işlenir.
- Metin doğru cevabı hiç söylemiyorsa seçili cevap (veya tek açık kalan şık) son cümlede işaretlenir. Metin başka bir cevap söylüyorsa uyarı verilir ve sesle uyumlu şık işaretlenir.
- Görünüm: incelenen şık dışındaki alan hafifçe kararır (spot), çerçeve çizilerek gelir, çarpı/tik renkli rozet olarak belirir, elenen şıklar soluklaşır, doğru cevap halka + "Doğru cevap" etiketiyle gelir ve tekrar söylendiğinde yeniden vurgulanır. Arapça ifadeler sesle birlikte sağdan sola fosforlu kalemle taranır.
- Altyazı, konuşulan kelimeyi kelime zamanlarıyla (karaoke) vurgular; Arapça kelimeler Türkçe satır içinde doğru sırada durur. Altta ince ilerleme çubuğu bulunur.
- Eski projeler için **Yeniden Oluştur** gerekir; ses yeniden üretilmez.

## Sabit şablonlu slaytlar ve şık düzenleri

- Üst bant, yönerge kutusu, soru numarası ve alt yazı şık/soru kökü sayılmaz.
- Şık etiketleri yanlış okunsa bile (`B)` → `(5`, `C)` → `0`, `E)` → `3`) bulunur. Okunan etiketlerle aynı boyuttaki parçalar okuma sırasına göre harf alır. Okunan harfler bu sırayla çelişirse atama yapılmaz.
- Desteklenen düzenler: A B / C D / E ızgarası, beş şık tek satır ve uzun şıklar tek sütun. Etiket metne yapışıp kaybolursa, satır/sütun aralığından bulunan konum yalnız orada gerçekten şık metni varsa kullanılır.
- Şık kutuları birbirine girmez; harekeler taşırsa ortak boşluk ikiye bölünür. Çerçeve, spot ve ✓/X rozetleri komşu şıkka taşmaz. Yan tarafta yer yoksa rozet boş tarafa ya da üste geçer.
- Arapça ifadeler kutu içine alınmaz; okunurken sağdan sola, alttaki harekelerin de altından geçen bir çizgiyle vurgulanır.
