import { createWorker, Worker } from 'tesseract.js';
import { groupOcrWordsIntoLines } from './arabicMatcher';
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
   * Initializes or returns the cached Tesseract worker configured for Arabic,
   * Turkish, and English. The worker is reused between questions so the large
   * language models are not downloaded/initialized on every video.
   */
  private async getWorker(onProgress?: (progress: OCRProgress) => void): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    if (this.isInitializing) {
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
              message: 'Dil modelleri yükleniyor (ara+tur+eng)...',
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
      img.onerror = () => resolve({ width: 1000, height: 1000 });
      img.src = imageUrl;
    });
  }

  private toOcrWord(rawWord: any, imgWidth: number, imgHeight: number): OCRWord | null {
    const text = String(rawWord?.text || '').trim();
    if (!text) return null;

    const bbox = rawWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
    const px = Math.max(0, Number(bbox.x0) || 0);
    const py = Math.max(0, Number(bbox.y0) || 0);
    const pw = Math.max(1, (Number(bbox.x1) || px + 1) - px);
    const ph = Math.max(1, (Number(bbox.y1) || py + 1) - py);

    return {
      text,
      confidence: Number(rawWord?.confidence ?? 80),
      x: Math.max(0, Math.min(1, px / imgWidth)),
      y: Math.max(0, Math.min(1, py / imgHeight)),
      width: Math.max(0.0001, Math.min(1, pw / imgWidth)),
      height: Math.max(0.0001, Math.min(1, ph / imgHeight)),
      pixelX: px,
      pixelY: py,
      pixelWidth: pw,
      pixelHeight: ph,
    };
  }

  private toOcrLine(rawLine: any, imgWidth: number, imgHeight: number): OCRLine | null {
    const text = String(rawLine?.text || '').trim();
    const rawWords = Array.isArray(rawLine?.words) ? rawLine.words : [];
    const lineWords = rawWords
      .map((w: any) => this.toOcrWord(w, imgWidth, imgHeight))
      .filter(Boolean) as OCRWord[];

    if (!text && lineWords.length === 0) return null;

    const bbox = rawLine?.bbox || (() => {
      if (lineWords.length === 0) return { x0: 0, y0: 0, x1: 1, y1: 1 };
      return {
        x0: Math.min(...lineWords.map((w) => w.pixelX)),
        y0: Math.min(...lineWords.map((w) => w.pixelY)),
        x1: Math.max(...lineWords.map((w) => w.pixelX + w.pixelWidth)),
        y1: Math.max(...lineWords.map((w) => w.pixelY + w.pixelHeight)),
      };
    })();

    const px = Math.max(0, Number(bbox.x0) || 0);
    const py = Math.max(0, Number(bbox.y0) || 0);
    const pw = Math.max(1, (Number(bbox.x1) || px + 1) - px);
    const ph = Math.max(1, (Number(bbox.y1) || py + 1) - py);

    return {
      text: text || lineWords.map((w) => w.text).join(' '),
      confidence: Number(rawLine?.confidence ?? 80),
      x: Math.max(0, Math.min(1, px / imgWidth)),
      y: Math.max(0, Math.min(1, py / imgHeight)),
      width: Math.max(0.0001, Math.min(1, pw / imgWidth)),
      height: Math.max(0.0001, Math.min(1, ph / imgHeight)),
      words: lineWords,
    };
  }

  /**
   * Tesseract.js v6+ disables granular output by default. Requesting
   * `{ blocks: true }` is essential: otherwise only `data.text` is returned
   * and the video pipeline has no word coordinates, which means no A-E regions
   * and therefore no animation targets.
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

    // Tesseract v6/v7: text is on by default, blocks must be explicitly enabled.
    const result = await worker.recognize(imageUrl, {}, { text: true, blocks: true });
    const data = result.data as any;

    const words: OCRWord[] = [];
    const lines: OCRLine[] = [];

    // Preferred v6/v7 structure: blocks -> paragraphs -> lines -> words.
    if (Array.isArray(data.blocks)) {
      for (const block of data.blocks) {
        for (const paragraph of block?.paragraphs || []) {
          for (const rawLine of paragraph?.lines || []) {
            const line = this.toOcrLine(rawLine, imgWidth, imgHeight);
            if (!line) continue;
            lines.push(line);
            words.push(...line.words);
          }
        }
      }
    }

    // Backward-compatible fallback for older Tesseract output shapes.
    if (words.length === 0 && Array.isArray(data.words)) {
      for (const rawWord of data.words) {
        const word = this.toOcrWord(rawWord, imgWidth, imgHeight);
        if (word) words.push(word);
      }
    }

    if (lines.length === 0 && Array.isArray(data.lines)) {
      for (const rawLine of data.lines) {
        const line = this.toOcrLine(rawLine, imgWidth, imgHeight);
        if (line) lines.push(line);
      }
    }

    // Stable visual ordering improves deterministic option/phrase detection.
    lines.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const orderedWords = groupOcrWordsIntoLines(words).flat();
    words.splice(0, words.length, ...orderedWords);

    if (words.length === 0) {
      throw new Error(
        'Soru görselindeki metin bölgeleri algılanamadı. Daha net veya daha yüksek çözünürlüklü bir görsel deneyin.'
      );
    }

    onProgress?.({
      status: 'completed',
      progress: 100,
      message: `${words.length} metin parçası ve ${lines.length} satır tespit edildi.`,
    });

    return {
      text: data.text || lines.map((l) => l.text).join('\n'),
      imageWidth: imgWidth,
      imageHeight: imgHeight,
      words,
      lines,
    };
  }

  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const localOcrService = LocalOcrService.getInstance();
