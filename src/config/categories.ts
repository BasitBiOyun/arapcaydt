export interface QuestionCategory {
  id: string;
  label: string;
  description?: string;
}

/**
 * Centrally defined Question Categories.
 * Currently confirmed:
 * 1. Soru Çöz
 * 2. Çıkmış Soru
 * 3. Deneme
 * (Architecture ready for a 4th category when provided)
 */
export const QUESTION_CATEGORIES: QuestionCategory[] = [
  { id: 'soru-coz', label: 'Soru Çöz', description: 'Konu anlatımlı pratik soru çözümleri' },
  { id: 'cikmis-soru', label: 'Çıkmış Soru', description: 'ÖSYM YDT / YDS çıkmış sınav soruları' },
  { id: 'deneme', label: 'Deneme', description: 'Özgün deneme sınavı soruları' },
  // 4th category slot will be inserted here when provided
];

export const DEFAULT_CATEGORY_ID = 'soru-coz';

export function getCategoryById(id: string): QuestionCategory | undefined {
  return QUESTION_CATEGORIES.find((c) => c.id === id);
}

export function getCategoryLabel(id: string): string {
  const cat = getCategoryById(id);
  return cat ? cat.label : id;
}
