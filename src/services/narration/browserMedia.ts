export function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}

/** Audio length from metadata; 15 s if the browser cannot read it (the old upload behaviour). */
export function readAudioDuration(url: string): Promise<number> {
  return new Promise(resolve => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 15);
    audio.onerror = () => resolve(15);
    audio.src = url;
  });
}

/** Saves a blob or URL as a file on the teacher's computer. */
export function saveFile(source: Blob | string, name: string): void {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking at once can cancel the download in some browsers.
  if (typeof source !== 'string') setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Longest side kept for question images: above the 1920×1080 video and OCR needs. */
export const MAX_IMAGE_SIDE = 2400;

/** Size an image is drawn at: never enlarged, longest side at most `max`. */
export function fittedSize(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * A question image as a data URL, re-encoded as high-quality WebP (and scaled
 * down if huge) to save storage. The original is kept when the browser cannot
 * make WebP or when the result would not be smaller.
 */
export async function readCompressedImage(file: Blob): Promise<string> {
  const original = await readDataUrl(file);
  if (!/^image\/(png|jpeg|webp|bmp)$/.test(file.type)) return original;
  try {
    const bitmap = await createImageBitmap(file);
    const size = fittedSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const webp = canvas.toDataURL('image/webp', 0.92);
    return webp.startsWith('data:image/webp') && webp.length < original.length ? webp : original;
  } catch {
    return original;
  }
}
