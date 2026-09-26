import { signatureFromGray, type TemplateProfile } from './templateProfile';

const KEY = 'arapcaydt.templateProfiles.v1';

/** Luminance signature of the slide's fixed strips; null outside the browser or on CORS/decode errors. */
export async function imageSignature(imageUrl: string): Promise<number[] | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); img.src = imageUrl; });
    const width = 192, height = 108;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < gray.length; i++) gray[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
    return signatureFromGray(gray, width, height);
  } catch {
    return null;
  }
}

export function loadTemplateProfiles(): TemplateProfile[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplateProfiles(profiles: TemplateProfile[]) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(profiles)); } catch { /* optional cache */ }
}
