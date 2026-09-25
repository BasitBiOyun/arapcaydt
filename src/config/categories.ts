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
  { id: 'arapca-ydt-hazirlik', label: 'ARAPÇA YDT HAZIRLIK' },
  { id: 'arapca-okul-dersleri-hazirlik', label: 'ARAPÇA OKUL DERSLERİ HAZIRLIK' },
  { id: 'dkab-yks-deneme', label: 'DKAB YKS DENEME' },
  { id: 'dkab-lgs-deneme', label: 'DKAB LGS DENEME' },
  { id: 'arapca-ydt-degerlendirme', label: 'ARAPÇA YDT DEĞERLENDİRME' },
  { id: 'dkab-yks-tarama', label: 'DKAB YKS TARAMA' },
  { id: 'dkab-yks-cikmis-sorular', label: 'DKAB YKS ÇIKMIŞ SORULAR' },
];

export const DEFAULT_CATEGORY_ID = 'soru-coz';

export function getCategoryById(id: string): QuestionCategory | undefined {
  return QUESTION_CATEGORIES.find((c) => c.id === id);
}

export function getCategoryLabel(id: string): string {
  const cat = getCategoryById(id);
  return cat ? cat.label : id;
}
