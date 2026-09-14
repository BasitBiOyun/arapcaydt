import { createWorker, Worker } from 'tesseract.js';
import { OCRWord, OCRLine, OCRResult, OCRProgress } from './ocrTypes';

class LocalOcrService {
  private static instance: LocalOcrService;
  private worker: Worker | null = null;
  private isInitializing = false;

  public static getInstance(): LocalOcrService {
    if (!LocalOcrService.instance) {
      LocalOcrService.instance = new LocalOcrService();
    }
    return LocalOcrService.instance;
  }

  /**
   * Initializes or returns the cached Tesseract worker configured for Arabic, Turkish, and English.
   */
  private async getWorker(onProgress?: (progress: OCRProgress) => void): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    if (this.isInitializing) {
      // Wait for initialization to finish
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.worker) return this.worker;
    }

    this.isInitializing = true;
    try {
      onProgress?.({
        status: 'initializing',
        progress: 10,
        message: 'Yerel OCR motoru başlatılıyor (Arapça + Türkçe)...',
      });

      // Initialize with Arabic, Turkish, and English language models
      const worker = await createWorker(['ara', 'tur', 'eng'], 1, {
        logger: (m) => {
          if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
            onProgress?.({
              status: 'loading_model',
              progress: 20 + Math.round((m.progress || 0) * 20),
              message: 'Tesseract OCR motoru hazırlanıyor...',
            });
          } else if (m.status === 'loading language traineddata') {
            onProgress?.({
              status: 'loading_model',
              progress: 40 + Math.round((m.progress || 0) * 30),
              message: `Dil modelleri yükleniyor (${m.userJobId || 'ara+tur+eng'})...`,
            });
          } else if (m.status === 'recognizing text') {
            onProgress?.({
              status: 'recognizing',
              progress: 70 + Math.round((m.progress || 0) * 28),
              message: `Soru metni taranıyor (%${Math.round((m.progress || 0) * 100)})...`,
            });
          }
        },
      });

      this.worker = worker;
      return worker;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Helper to load image and extract its true natural pixel dimensions
   */
  private async getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width || 1000,
          height: img.naturalHeight || img.height || 1000,
        });
      };
      img.onerror = () => {
        resolve({ width: 1000, height: 1000 });
      };
      img.src = imageUrl;
    });
  }

  /**
   * Runs local OCR in the browser on the question image.
   * Extracts text, lines, words, and normalized bounding box coordinates.
   */
  public async recognize(
    imageUrl: string,
    onProgress?: (progress: OCRProgress) => void
  ): Promise<OCRResult> {
    if (!imageUrl) {
      throw new Error('Geçerli bir soru görseli bulunamadı.');
    }

    const { width: imgWidth, height: imgHeight } = await this.getImageDimensions(imageUrl);

    onProgress?.({
      status: 'initializing',
      progress: 5,
      message: 'Görsel boyutları doğrulandı, OCR başlatılıyor...',
    });

    const worker = await this.getWorker(onProgress);

    onProgress?.({
      status: 'recognizing',
      progress: 70,
      message: 'Soru ve şıklar taranıyor...',
    });

    const result = await worker.recognize(imageUrl);
    const data = result.data as any;

    const words: OCRWord[] = [];
    const lines: OCRLine[] = [];

    // Parse words
    if (data.words && Array.isArray(data.words)) {
      for (const w of data.words) {
        const text = (w.text || '').trim();
        if (!text) continue;

        const bbox = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
        const px = Math.max(0, bbox.x0);
        const py = Math.max(0, bbox.y0);
        const pw = Math.max(1, bbox.x1 - bbox.x0);
        const ph = Math.max(1, bbox.y1 - bbox.y0);

        words.push({
          text,
          confidence: w.confidence ?? 80,
          x: px / imgWidth,
          y: py / imgHeight,
          width: pw / imgWidth,
          height: ph / imgHeight,
          pixelX: px,
          pixelY: py,
          pixelWidth: pw,
          pixelHeight: ph,
        });
      }
    }

    // Parse lines
    if (data.lines && Array.isArray(data.lines)) {
      for (const l of data.lines) {
        const text = (l.text || '').trim();
        if (!text) continue;

        const bbox = l.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
        const px = Math.max(0, bbox.x0);
        const py = Math.max(0, bbox.y0);
        const pw = Math.max(1, bbox.x1 - bbox.x0);
        const ph = Math.max(1, bbox.y1 - bbox.y0);

        const lineWords: OCRWord[] = [];
        if (l.words && Array.isArray(l.words)) {
          for (const lw of l.words) {
            const wText = (lw.text || '').trim();
            if (!wText) continue;
            const wb = lw.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
            lineWords.push({
              text: wText,
              confidence: lw.confidence ?? 80,
              x: wb.x0 / imgWidth,
              y: wb.y0 / imgHeight,
              width: (wb.x1 - wb.x0) / imgWidth,
              height: (wb.y1 - wb.y0) / imgHeight,
              pixelX: wb.x0,
              pixelY: wb.y0,
              pixelWidth: wb.x1 - wb.x0,
              pixelHeight: wb.y1 - wb.y0,
            });
          }
        }

        lines.push({
          text,
          confidence: l.confidence ?? 80,
          x: px / imgWidth,
          y: py / imgHeight,
          width: pw / imgWidth,
          height: ph / imgHeight,
          words: lineWords,
        });
      }
    }

    onProgress?.({
      status: 'completed',
      progress: 100,
      message: 'OCR taraması başarıyla tamamlandı.',
    });

    return {
      text: data.text || '',
      imageWidth: imgWidth,
      imageHeight: imgHeight,
      words,
      lines,
    };
  }

  /**
   * Terminate worker to free memory if needed
   */
  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const localOcrService = LocalOcrService.getInstance();
