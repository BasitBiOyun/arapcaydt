/**
 * "Yenilikler": what changed for teachers, one entry per day (id YYYY-MM-DD, date "1 Ekim 2026"),
 * newest first. A new change goes into today's entry, under a group title; a new day gets a new
 * entry. Plain Turkish, one sentence per item; `help` links to a Yardım topic.
 */
export interface NewsItem { text: string; help?: string }
export interface NewsEntry { id: string; date: string; title: string; groups: { title: string; items: NewsItem[] }[] }

export const NEWS: NewsEntry[] = [
  {
    id: '2026-10-02',
    date: '2 Ekim 2026',
    title: 'Yedek ses modeli artık sorulmadan kullanılmıyor',
    groups: [
      {
        title: 'Seslendirme',
        items: [
          { text: '**Yedek modele geçmeden önce sorulur:** En üst düzey ses modelinin günlük kullanım hakkı bitince stüdyo artık sessizce yedek modele geçmez. “Yedek modelle seslendir” ya da “Yarını bekleyeceğim” diye sorar. Yedek model araya olmayan cümle katabilir, olumsuzu olumlu okuyabilir, Türkçeyi yanlış telaffuz edebilir.', help: 'seslendirme' },
          { text: 'Yedek modelle üretilen sesin altında bunu söyleyen bir not çıkar; sesi dinleyip hatalı cümleyi **Sesi düzelt** ile yenileyin.', help: 'seslendirme' },
          { text: 'Kendi Google anahtarı olan hocalarda, kendi anahtarındaki en üst düzey modelin hakkı bitince önce stüdyonun anahtarındaki en üst düzey model denenir (önceden hemen yedek modele geçiliyordu).', help: 'seslendirme' },
        ],
      },
    ],
  },
  {
    id: '2026-10-01',
    date: '1 Ekim 2026',
    title: 'Daha hızlı düzenleme: alt çizgi, daire, “Şimdi”; şık düzeltmeleri',
    groups: [
      {
        title: 'İşaretler ekranı',
        items: [
          { text: '**Alt çizgi aracı (▁):** Çizginin başlayacağı yere basın, sağa ya da sola sürükleyip bırakın. Kalınlığı sabit, yalnız boyu değişir. Yazının hemen altına bırakırsanız satıra kendisi oturur; videoda çizgi sürüklediğiniz yönde akar.', help: 'isaretler' },
          { text: '**Daire aracı (◯):** Bir kelimenin ya da şıkkın etrafına elle çizilmiş gibi bir halka çizer.', help: 'isaretler' },
          { text: '**“Şimdi” ile zamanlama:** Zaman şeridinde bir işarete tıklayın, sesi oynatın. Çıkması gereken anda **Şimdi başlasın**’a (ya da Enter’a), bitmesi gereken anda **Şimdi bitsin**’e basın.', help: 'isaretler' },
          { text: '**Çarpı ve tik tıkladığınız yere konur:** Aracı seçip görselde bir noktaya tıklayın, işaret tam oraya gelir; kendisinden tutup taşıyabilir, köşesinden büyütebilirsiniz. Bir şıkka tıklarsanız eskisi gibi o şık işaretlenir.', help: 'isaretler' },
          { text: '**Çizgi yalnız çizgidir:** Çizdiğiniz çizginin etrafında kutu yok; seçince yalnız iki ucunda tutamak çıkar, ortasından tutup taşırsınız.', help: 'isaretler' },
          { text: '**Daire çizdiğiniz yere oturur** ve kendisinden tutulup taşınır, kenarlarından büyütülür.', help: 'isaretler' },
          { text: '**Küçük araç çubuğu:** Bir işareti seçince büyük pencere yerine küçük bir çubuk çıkar: saat, buraya al, sil, kopyala. Taşırken yazı satırlarına ve diğer işaretlere hizalanır.', help: 'isaretler' },
          { text: 'Büyütüp küçültünce mavi tutamaklar işaretle birlikte hemen yerine oturur.' },
          { text: 'Arka arkaya çizilen çizgilerin her biri önizlemenin durduğu anda başlar ve hemen turuncu görünür; zamanını şeritten ayarlarsınız.', help: 'isaretler' },
          { text: 'Uzun şıkları okuyan sorularda sağdaki listede yanlış “Arapça paragrafın altı çizilemedi” uyarıları artık çıkmaz (şıkların altı zaten şıkta çiziliyor). Eski sorularda **İşaretleri yeniden hazırla**’ya basınca kalkar.' },
          { text: 'Önizleme dururken eklediğiniz işaret hemen görünür (önceden oynatmadan görünmüyordu).' },
          { text: '**Uzun şıkların altı çizilir:** Çözüm bir şıkkın beş kelimeden uzun Arapça cümlesini okurken (“A seçeneğinde şöyle deniyor: …”), o cümlenin altı şıkkın kendi satırlarında, okundukça çizilir. Kısa şıklar yalnız çerçevelenir.', help: 'isaretler' },
        ],
      },
      {
        title: 'Düzeltmeler',
        items: [
          { text: 'Stüdyonun kendi görsel okuyucusu (Google’ın okuyucusu kullanılamadığında devreye giren) daha iyi okuyor: görseli büyütüp siyah-beyaz yapıyor, soluk filigranlar artık okumayı bozmuyor. Denemelerde Arapça kelimeleri doğru yerde bulma oranı %86’dan %95’e çıktı.', help: 'isaretler' },
          { text: 'İki ya da üç satıra taşan şıkların son satırı da şıkkın çerçevesine girer (Arapçada kısa son satır sağa yaslı olduğu için dışarıda kalıyordu).' },
          { text: 'Önizleme oynarken soru artık hafifçe büyüyüp küçülmüyor; boyutu sabit kalıyor.' },
          { text: 'Boşluk doldurma (cloze) sorularında, şıklar solda paragraf sağdayken E şıkkının kutusu artık paragrafa değil E şıkkının kendisine konur.' },
          { text: 'Stüdyonun yeni sürümü yayınlandığında açık sayfada mavi bir uyarı çıkar: **Sayfayı yenile**’ye basınca düzeltmeler hemen çalışır.' },
          { text: 'Ses yazıya dökülürken okunan Arapça cümle atlanırsa, o cümlenin altı artık cümle okunurken çizilir (önceden cümle bittikten sonra, bir sonraki Türkçe cümlede çiziliyordu).' },
          { text: 'Soru küçültüldüğünde üst bant ve sayfa rengi ekranın iki yanına kadar uzanır; kenarlarda beyaz boşluk kalmaz.' },
          { text: 'Google’ın okuyucusu anlık “kaynak tükendi” cevabı verdiğinde stüdyo birkaç saniye bekleyip tekrar dener; görsel gereksiz yere zayıf okuyucuyla okunmaz.' },
          { text: 'Soru küçültüldüğünde bir şık vurgulanırken yalnız soru değil bütün ekran birlikte kararıyor; kenarlarda beyaz şerit kalmıyor.' },
          { text: 'Paragrafın şıkların yanında basıldığı sorularda bir şıkkın çerçevesi artık yandaki paragrafa taşmıyor.' },
          { text: 'Bir şıkkı okurken (“A) …” ya da “A şıkkı: …”) aynı kelimeler paragrafta da geçse, paragrafın altı çizilmiyor; o anda yalnız şık gösteriliyor. Çözümde “parçada …” diye paragrafa gönderme yaparsanız çizgi yine çıkar.' },
          { text: 'Daha önce hazırlanmış sorularda düzeltmenin görünmesi için **İşaretleri yeniden hazırla**’ya basın.', help: 'isaretler' },
          { text: 'Bir sorunun görseli Google’ın okuyucusuyla bir kez okununca okuma soruyla birlikte saklanır. **İşaretleri yeniden hazırla**’ya kaç kez basarsanız basın günlük okuma hakkınızdan düşmez; günlük hakkınız bitmiş olsa bile o soru aynı kalitede hazırlanır. Görseli değiştirirseniz yeni görsel bir kez daha okunur.' },
        ],
      },
    ],
  },
  {
    id: '2026-09-30',
    date: '30 Eylül 2026',
    title: 'Alt çizgiler doğru satırda, toplu hazırlama ve tek tuşla sorun bildirme',
    groups: [
      {
        title: 'Görsel okuma ve alt çizgiler',
        items: [
          { text: 'Uzun Arapça paragraflarda her satırın altı, o satır okunurken doğru satıra çizilir; çizgilerin alt satıra kayması giderildi.' },
          { text: 'Numaralı cümleli (I, II, III…) sorularda ve filigranlı görsellerde de satırlar doğru bulunur.' },
          { text: 'Bir kelimesi yanlış okunsa bile üç ve daha uzun kelimelik Arapça ifadelerin altı tek parça çizilir.' },
          { text: 'Soru görselleri Google’ın okuyucusuyla okunur; her hocanın günde 30 okuma hakkı vardır. Hak bitince eski okuyucu devreye girer.' },
        ],
      },
      {
        title: 'İşaretler ekranı',
        items: [
          { text: 'Ses adımından sonra soru ekrana kaydırmadan sığar; küçük ekranlarda düzenleme kolaylaştı.' },
          { text: 'Yanlış bir şey görürseniz **Burada hata var**’a basın: video durur ve az önce çıkan işaretin kutusu seçilir.', help: 'isaretler' },
          { text: 'Bir kutuya tıklayınca **Hangi şık?** satırı çıkar; harfe basınca kutu o şık olur, çarpısı ya da tiki sese göre kendiliğinden gelir.', help: 'isaretler' },
          { text: 'Kutular **Ctrl+C / Ctrl+V** ile kopyalanıp yapıştırılır; Boşluk, Esc, Delete ve Ctrl+Z kısayolları çalışır.' },
          { text: 'Tik işaretinin yanındaki boş kutucuk kaldırıldı.' },
          { text: '**Sade uyarılar:** Her uyarı tek cümledir ve yanında işi yapan düğme vardır (“Görselde düzelt”, “Zamanlamayı aç” gibi).' },
          { text: '**Yardım** sayfasına Ses ve İşaretler adımları için resimli, tam rehber eklendi.', help: 'isaretler' },
        ],
      },
      {
        title: 'Ses',
        items: [
          { text: 'Yaklaşık 450 kelimeye kadar olan çözümler tek seferde, bütün hâlinde seslendirilir. Daha uzunlar yalnız cümle ya da paragraf sonlarından bölünür.', help: 'seslendirme' },
          { text: 'Seste okunan Arapça cümleler artık yanlışlıkla “okunmamış” görünmez; uyarı yalnız gerçekten atlanan yerde çıkar.' },
          { text: '“Sesi düzelt” cümleyi yerinde değiştirir, araya kopya eklemez ve önceki cümleden kırpmaz.', help: 'seslendirme' },
          { text: 'Ses servisi anlık yanıt vermezse üretilen ses kaybolmaz ve boş dönen istekler hakkınızı harcamaz. Hata görürseniz art arda basmak yerine bir iki dakika bekleyip deneyin.' },
          { text: '“Sesi düzelt” ile yeniden okunan parçanın ses yüksekliği artık çevresine göre ayarlanır; araya giren parça daha yüksek ya da kısık duyulmaz.', help: 'seslendirme' },
        ],
      },
      {
        title: 'Sorularım ve sorun bildirme',
        items: [
          { text: '**Toplu “İşaretleri hazırla”:** Sorularım’da birkaç soruyu seçip bu düğmeye basın. İşaretler sırayla hazırlanır; sonunda hangi sorunun kontrol istediği tek listede çıkar.', help: 'soru-listesi' },
          { text: '**Tek tuşla sorun bildirme:** Bir soruda işaret yanlış çıkarsa **Sorun bildir**’e basıp uygun seçeneği işaretleyin (çizgi yanlış yerde, tik yanlış şıkta, ses yanlış okudu…). Yazmanız ya da dosya indirmeniz gerekmez; sorunun bilgileri bize kendiliğinden ulaşır.', help: 'sorun-bildir' },
          { text: '**Tamamlandı:** MP4’ü indirince soru tamamlandı sayılır. Değişiklik isterseniz **Düzenlemeye geri aç** ile açabilirsiniz.', help: 'video-indir' },
        ],
      },
    ],
  },
];

const SEEN = 'studio-news-seen';
/** The newest entry this device has shown, so the menu marks only what is new. */
export const readSeen = (): string => { try { return localStorage.getItem(SEEN) || ''; } catch { return ''; } };
const itemCount = (entry: NewsEntry) => entry.groups.reduce((n, g) => n + g.items.length, 0);
/** What was seen: the newest day and how many items it had then (a day can get more items later). */
export const newsStamp = () => `${NEWS[0].id}#${itemCount(NEWS[0])}`;
export function markNewsSeen() {
  try { localStorage.setItem(SEEN, newsStamp()); } catch { /* per-device only */ }
  window.dispatchEvent(new Event('studio-news-seen'));
}
/** Days newer than the one last seen, and that day again if it has got new items (everything on a first visit). */
export function unseenNews(seen: string): NewsEntry[] {
  if (!seen) return NEWS;
  const [day, count] = [seen.slice(0, 10), Number(seen.split('#')[1]) || 0];
  return NEWS.filter(entry => entry.id > day || (entry.id === day && itemCount(entry) > count));
}
