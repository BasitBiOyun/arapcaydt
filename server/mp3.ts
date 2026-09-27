/**
 * Narration audio is stored as MP3 (mono, 64 kbps): speech stays clear and a
 * minute of audio takes ~0.5 MB instead of ~2.9 MB as 24 kHz WAV, which keeps
 * the free Supabase storage (1 GB) usable for the whole question pool.
 *
 * LAME delays decoded audio by 1105 samples (~46 ms at 24 kHz). When the
 * narration starts with that much silence (TTS always does) it is trimmed
 * before encoding, so the MP3 timeline matches the source PCM exactly: word
 * timings taken from the old WAV stay valid after conversion.
 */
export const ENCODER_DELAY_SAMPLES = 1105;
const SILENCE = 330; // ~1% of full scale
export const MP3_KBPS = 64;
const CHUNK = 1152 * 16;

export interface Pcm { samples: Int16Array; sampleRate: number }

/** 16-bit PCM from a WAV file (the first channel when it is stereo). */
export function pcmFromWav(wav: Buffer): Pcm | null {
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') return null;
  let offset = 12, sampleRate = 0, channels = 1, bits = 16, format = 1;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ' && size >= 16) {
      format = wav.readUInt16LE(body);
      channels = wav.readUInt16LE(body + 2);
      sampleRate = wav.readUInt32LE(body + 4);
      bits = wav.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (format !== 1 || bits !== 16 || !sampleRate || channels < 1) return null;
      const end = Math.min(wav.length, body + size);
      const frames = Math.floor((end - body) / (2 * channels));
      const samples = new Int16Array(frames);
      for (let i = 0; i < frames; i++) samples[i] = wav.readInt16LE(body + i * 2 * channels);
      return { samples, sampleRate };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

/** Raw little-endian 16-bit mono PCM (Gemini's audio/L16 output). */
export function pcmFromRaw(raw: Buffer, sampleRate: number): Pcm {
  const samples = new Int16Array(Math.floor(raw.length / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = raw.readInt16LE(i * 2);
  return { samples, sampleRate };
}

/** Drops the encoder delay from a silent start so decoded MP3 time equals source time. */
export function trimEncoderDelay(samples: Int16Array): Int16Array {
  if (samples.length <= ENCODER_DELAY_SAMPLES) return samples;
  for (let i = 0; i < ENCODER_DELAY_SAMPLES; i++) if (Math.abs(samples[i]) > SILENCE) return samples;
  return samples.subarray(ENCODER_DELAY_SAMPLES);
}

// Loaded with import(): the package's CommonJS entry exports nothing, so a
// bundled `require` (dist/server.cjs) would break; import() picks the ESM build.
let encoderClass: Promise<typeof import('@breezystack/lamejs').Mp3Encoder> | null = null;
const loadEncoder = () => (encoderClass ??= import('@breezystack/lamejs').then(m => m.Mp3Encoder));

export async function encodeMp3({ samples, sampleRate }: Pcm, kbps = MP3_KBPS): Promise<Buffer> {
  const Mp3Encoder = await loadEncoder();
  samples = trimEncoderDelay(samples);
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += CHUNK) {
    const out = encoder.encodeBuffer(samples.subarray(i, i + CHUNK));
    if (out.length) parts.push(out);
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(tail);
  return Buffer.concat(parts.map(p => Buffer.from(p.buffer, p.byteOffset, p.length)));
}

export const pcmSeconds = ({ samples, sampleRate }: Pcm) => sampleRate > 0 ? samples.length / sampleRate : 0;

/**
 * The file to store for a narration WAV: MP3 when it can be encoded, the WAV
 * itself otherwise (an encoder problem must never lose a generated narration).
 */
export async function storedNarrationAudio(wav: Buffer): Promise<{ bytes: Buffer; mimeType: string; extension: string }> {
  const pcm = pcmFromWav(wav);
  if (pcm && pcm.samples.length) {
    try {
      const mp3 = await encodeMp3(pcm);
      if (mp3.length) return { bytes: mp3, mimeType: 'audio/mpeg', extension: 'mp3' };
    } catch (error: any) {
      console.warn('[MP3] encoding failed, keeping WAV:', error?.message || error);
    }
  }
  return { bytes: wav, mimeType: 'audio/wav', extension: 'wav' };
}
