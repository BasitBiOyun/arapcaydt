/**
 * Picture clean-up before the in-browser reader. Measured on real questions
 * (Vision's reading as the reference): doubling the size and turning the page
 * pure black-and-white lifted Arabic words found at the right place from 86% to
 * 95% — the light-gray watermark and anti-aliased edges drop out.
 */
export const READ_SCALE = 2;
const CUT = 170;
const MAX_SIDE = 4200;

/** Grayscale then black/white, in place (RGBA pixels). */
export function binarize(pixels: Uint8ClampedArray, cut = CUT): Uint8ClampedArray {
  for (let i = 0; i < pixels.length; i += 4) {
    const light = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
    // Transparent pixels count as paper.
    const value = pixels[i + 3] < 128 || light >= cut ? 255 : 0;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
    pixels[i + 3] = 255;
  }
  return pixels;
}

export function readScale(width: number, height: number): number {
  return Math.max(1, Math.min(READ_SCALE, MAX_SIDE / Math.max(width, height, 1)));
}

/** The cleaned picture and how much bigger it is; null if the browser cannot draw it. */
export async function prepareForReading(imageUrl: string, width: number, height: number): Promise<{ image: HTMLCanvasElement; scale: number } | null> {
  if (typeof document === 'undefined') return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = imageUrl; });
    const scale = readScale(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    binarize(frame.data);
    ctx.putImageData(frame, 0, 0);
    return { image: canvas, scale };
  } catch {
    return null;
  }
}
