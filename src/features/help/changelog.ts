/**
 * "Yenilikler": what changed for teachers, newest first. Add an entry with every update teachers
 * can notice (plain Turkish, one sentence per item; `help` links to a Yardım topic).
 */
export interface NewsItem { text: string; help?: string }
export interface NewsEntry { id: string; date: string; title: string; groups: { title: string; items: NewsItem[] }[] }

export const NEWS: NewsEntry[] = [
  {
    id: '2026-10-01-ogle',
    date: '1 Ekim 2026 · öğle',
    title: 'Yanında paragraf olan sorularda şıklar düzeldi',
    groups: [{
      title: 'Düzeltmeler',
      items: [
        { text: 'Paragrafın şıkların yanında basıldığı sorularda bir şıkkın çerçevesi artık yandaki paragrafa taşmıyor.' },
        { text: 'Bir şıkkı okurken (“A) …” ya da “A şıkkı: …”) aynı kelimeler paragrafta da geçse, paragrafın altı çizilmiyor; o anda yalnız şık gösteriliyor. Çözümde “parçada …” diye paragrafa gönderme yaparsanız çizgi yine çıkar.' },
        { text: 'Daha önce hazırlanmış sorularda düzeltmenin görünmesi için **İşaretleri yeniden hazırla**’ya basın.', help: 'isaretler' },
      ],
    }],
  },
  {
    id: '2026-10-01',
    date: '1 Ekim 2026',
    title: 'Daha hızlı düzenleme: alt çizgi, daire ve “Şimdi”',
    groups: [{
      title: 'İşaretler ekranı',
      items: [
        { text: '**Alt çizgi aracı (▁):** Çizginin başlayacağı yere basın, sağa ya da sola sürükleyip bırakın. Kalınlığı sabit, yalnız boyu değişir. Yazının hemen altına bırakırsanız satıra kendisi oturur; videoda çizgi sürüklediğiniz yönde akar.', help: 'isaretler' },
        { text: '**Daire aracı (◯):** Bir kelimenin ya da şıkkın etrafına elle çizilmiş gibi bir halka çizer.', help: 'isaretler' },
        { text: '**“Şimdi” ile zamanlama:** Zaman şeridinde bir işarete tıklayın, sesi oynatın. Çıkması gereken anda **Şimdi başlasın**’a (ya da Enter’a), bitmesi gereken anda **Şimdi bitsin**’e basın.', help: 'isaretler' },
        { text: '**Kelimeden zamanlama:** Şeridin altında o anda söylenen kelimeler yazar. Bir işaret seçiliyken kelimeye tıklarsanız işaret tam o kelimede başlar.', help: 'isaretler' },
      ],
    }],
  },
  {
    id: '2026-09-30-aksam',
    date: '30 Eylül 2026 · akşam',
    title: 'Toplu hazırlama ve tek tuşla sorun bildirme',
    groups: [{
      title: 'Yenilikler',
      items: [
        { text: '**Toplu “İşaretleri hazırla”:** Sorularım’da birkaç soruyu seçip bu düğmeye basın. İşaretler sırayla hazırlanır; sonunda hangi sorunun kontrol istediği tek listede çıkar.', help: 'soru-listesi' },
        { text: '**Tek tuşla sorun bildirme:** Bir soruda işaret yanlış çıkarsa **Sorun bildir**’e basıp uygun seçeneği işaretleyin (çizgi yanlış yerde, tik yanlış şıkta, ses yanlış okudu…). Yazmanız ya da dosya indirmeniz gerekmez; sorunun bilgileri bize kendiliğinden ulaşır.', help: 'sorun-bildir' },
        { text: '**Sade uyarılar:** Her uyarı tek cümledir ve yanında işi yapan düğme vardır (“Görselde düzelt”, “Zamanlamayı aç” gibi).' },
        { text: '**Tamamlandı:** MP4’ü indirince soru tamamlandı sayılır. Değişiklik isterseniz **Düzenlemeye geri aç** ile açabilirsiniz.', help: 'video-indir' },
        { text: '“Sesi düzelt” ile yeniden okunan parçanın ses yüksekliği artık çevresine göre ayarlanır; araya giren parça daha yüksek ya da kısık duyulmaz.', help: 'seslendirme' },
        { text: 'Soru görselleri Google’ın okuyucusuyla okunur; her hocanın günde 30 okuma hakkı vardır. Hak bitince eski okuyucu devreye girer.' },
      ],
    }],
  },
  {
    id: '2026-09-30',
    date: '30 Eylül 2026',
    title: 'Alt çizgiler doğru satırda, düzenleme ekranı sadeleşti',
    groups: [
      {
        title: 'Görsel okuma ve alt çizgiler',
        items: [
          { text: 'Uzun Arapça paragraflarda her satırın altı, o satır okunurken doğru satıra çizilir; çizgilerin alt satıra kayması giderildi.' },
          { text: 'Numaralı cümleli (I, II, III…) sorularda ve filigranlı görsellerde de satırlar doğru bulunur.' },
          { text: 'Bir kelimesi yanlış okunsa bile üç ve daha uzun kelimelik Arapça ifadelerin altı tek parça çizilir.' },
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
        ],
      },
    ],
  },
];

const SEEN = 'studio-news-seen';
/** The newest entry this device has shown, so the menu marks only what is new. */
export const readSeen = (): string => { try { return localStorage.getItem(SEEN) || ''; } catch { return ''; } };
export function markNewsSeen() {
  try { localStorage.setItem(SEEN, NEWS[0].id); } catch { /* per-device only */ }
  window.dispatchEvent(new Event('studio-news-seen'));
}
/** Entries newer than the last one seen (all of them on a first visit). */
export const unseenNews = (seen: string) => NEWS.filter(entry => !seen || entry.id > seen);
