export interface QuestionCategory {
  id: string;
  label: string;
  description?: string;
}

/**
 * Centrally defined question types.
 * Keep ids stable because saved projects and admin analytics depend on them.
 */
export const QUESTION_CATEGORIES: QuestionCategory[] = [
  { id: 'soru-coz', label: 'Soru Çöz', description: 'Konu anlatımlı pratik soru çözümleri' },
  { id: 'cikmis-soru', label: 'Çıkmış Soru', description: 'ÖSYM YDT / YDS çıkmış sınav soruları' },
  { id: 'deneme', label: 'Deneme', description: 'Özgün deneme sınavı soruları' },
  { id: 'arapca-ydt-hazirlik', label: 'Arapça YDT Hazırlık', description: 'YDT Arapça hazırlığı için konu, kelime ve soru çalışmaları' },
  { id: 'arapca-okul-dersleri-hazirlik', label: 'Arapça Okul Dersleri Hazırlık', description: 'Okul dersleri, yazılılar ve sınıf içi çalışmalar için hazırlık soruları' },
  { id: 'dkab-yks-deneme', label: 'DKAB YKS Deneme', description: 'YKS DKAB formatına uygun özgün deneme soruları' },
  { id: 'dkab-lgs-deneme', label: 'DKAB LGS Deneme', description: 'LGS DKAB formatına uygun özgün deneme soruları' },
  { id: 'arapca-ydt-degerlendirme', label: 'Arapça YDT Değerlendirme', description: 'YDT Arapça kazanımlarını ölçme ve değerlendirme soruları' },
  { id: 'dkab-yks-tarama', label: 'DKAB YKS Tarama', description: 'Konu ve kazanım tarama amaçlı YKS DKAB soru setleri' },
  { id: 'dkab-yks-cikmis-sorular', label: 'DKAB YKS Çıkmış Sorular', description: 'YKS’de çıkmış DKAB soruları ve çözüm çalışmaları' },
];

export const DEFAULT_CATEGORY_ID = 'soru-coz';

export function getCategoryById(id: string): QuestionCategory | undefined {
  return QUESTION_CATEGORIES.find((c) => c.id === id);
}

export function getCategoryLabel(id: string): string {
  const cat = getCategoryById(id);
  return cat ? cat.label : id;
}
