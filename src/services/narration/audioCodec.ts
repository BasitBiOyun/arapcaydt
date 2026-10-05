/** Narration audio in the browser: decoded to samples for editing, stored again as MP3 (like the server does). */
export const NARRATION_RATE = 24000;
const ENCODER_DELAY = 1105;
const SILENT = 0.01;

/** Mono samples of an audio file or link, at the narration's rate. */
export async function decodeAudio(source: string | Blob): Promise<Float32Array> {
  const bytes = typeof source === 'string' ? await (await fetch(source, { cache: 'no-store' })).arrayBuffer() : await source.arrayBuffer();
  const context = new OfflineAudioContext(1, 1, NARRATION_RATE);
  const audio = await context.decodeAudioData(bytes);
  return audio.getChannelData(0).slice();
}

/**
 * MP3 (mono, 64 kbps) of the samples. The encoder's start delay is taken from the leading silence,
 * so decoding the file gives the same timeline and word timings stay valid after each edit.
 */
export async function encodeMp3(samples: Float32Array, rate = NARRATION_RATE): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  let start = 0;
  if (samples.length > ENCODER_DELAY && samples.subarray(0, ENCODER_DELAY).every(v => Math.abs(v) < SILENT)) start = ENCODER_DELAY;
  const pcm = new Int16Array(samples.length - start);
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i + start] * 32767)));
  const encoder = new Mp3Encoder(1, rate, 64);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152 * 16) {
    const out = encoder.encodeBuffer(pcm.subarray(i, i + 1152 * 16));
    if (out.length) chunks.push(new Uint8Array(out));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  return new Blob(chunks as Uint8Array<ArrayBuffer>[], { type: 'audio/mpeg' });
}
