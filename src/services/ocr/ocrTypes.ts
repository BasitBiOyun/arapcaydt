export interface OCRWord {
  text: string;
  confidence: number;
  // Normalized coordinates [0, 1] relative to image dimensions
  x: number;
  y: number;
  width: number;
  height: number;
  // Pixel coordinates for debugging or high-precision layout math
  pixelX: number;
  pixelY: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface OCRLine {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  words: OCRWord[];
}

export interface OCRResult {
  /** Which reader read the picture. */
  engine?: 'vision' | 'tesseract';
  /** Why Google Vision was not used (shown to the teacher), when it was tried. */
  cloudIssue?: string;
  /** Google Vision's reading to keep with the question (its picture's key and the page). */
  visionReading?: { key: string; page: import('./cloudOcr').VisionPage };
  /** Dedicated Arabic-only stem pass; independent alternative to mixed OCR. */
  arabicStemWords?: OCRWord[];
  /** Independent Latin-label pass; never mix its Arabic guesses into words. */
  optionMarkers?: OCRWord[];
  text: string;
  imageWidth: number;
  imageHeight: number;
  words: OCRWord[];
  lines: OCRLine[];
}

export interface OCRProgress {
  status: 'initializing' | 'loading_model' | 'recognizing' | 'completed' | 'failed';
  progress: number; // 0 to 100
  message: string;
}
