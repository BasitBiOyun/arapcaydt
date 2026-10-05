/**
 * Topic (konu) suggestions for a question. A teacher may also type a topic of their own; the
 * list only keeps the same topic from being spelled several ways across the commission.
 */
export const TOPIC_SUGGESTIONS = [
  'Kelime bilgisi', 'Eş ve zıt anlamlı kelimeler', 'Cümle tamamlama', 'Boşluk doldurma (paragraf)', 'Diyalog tamamlama',
  'Okuma anlama (paragraf)', 'Paragrafta anlam bütünlüğü', 'Anlamca en yakın cümle', 'Çeviri (Arapça → Türkçe)', 'Çeviri (Türkçe → Arapça)',
  'Fiiller (mazi, muzari, emir)', 'Mezid fiiller', 'Mechul fiil', 'İsim cümlesi (mübteda-haber)', 'Fiil cümlesi (fail-mef’ul)',
  'Kâne ve kardeşleri', 'İnne ve kardeşleri', 'İsm-i mevsul', 'İşaret isimleri', 'Zamirler', 'Harf-i cerler', 'Sıfat tamlaması',
  'İsim tamlaması (izafet)', 'Sayılar', 'Hal', 'Temyiz', 'Mef’ul-ü mutlak / li eclih', 'İstisna', 'Şart cümlesi', 'Soru edatları',
  'Olumsuzluk (nefy, nehy)', 'Bağlaçlar ve edatlar', 'Masdar', 'İsm-i fail ve ism-i mef’ul', 'İsm-i tafdil', 'Çoğul türleri',
];

/** Suggestions first, then the teacher's own topics that are not among them, each once. */
export function topicChoices(used: Array<string | undefined>): string[] {
  const own = [...new Set(used.map(t => t?.trim()).filter((t): t is string => !!t))]
    .filter(t => !TOPIC_SUGGESTIONS.some(s => s.toLocaleLowerCase('tr') === t.toLocaleLowerCase('tr')))
    .sort((a, b) => a.localeCompare(b, 'tr'));
  return [...TOPIC_SUGGESTIONS, ...own];
}
