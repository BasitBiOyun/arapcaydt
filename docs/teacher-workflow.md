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

