/**
 * Every exported video at the same loudness: narration is measured as integrated loudness
 * (ITU-R BS.1770: K-weighting, 400 ms blocks, -70 LUFS absolute and -10 LU relative gates)
 * and scaled to TARGET_LUFS, without letting the loudest sample pass PEAK_CEILING.
 */
export const TARGET_LUFS = -16;
const PEAK_CEILING = 0.89; // about -1 dBFS
const MIN_GAIN = 0.1, MAX_GAIN = 8;

type Biquad = [number, number, number, number, number]; // b0 b1 b2 a1 a2

/** The two K-weighting stages (high shelf, then high pass) for any sample rate. */
function kWeighting(rate: number): Biquad[] {
  let K = Math.tan(Math.PI * 1681.974450955533 / rate);
  const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0,
    2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  K = Math.tan(Math.PI * 38.13547087602444 / rate);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  const highPass: Biquad = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  return [shelf, highPass];
}

function filtered(data: Float32Array, stages: Biquad[]): Float64Array {
  const out = Float64Array.from(data);
  for (const [b0, b1, b2, a1, a2] of stages) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < out.length; i++) {
      const x = out[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y; out[i] = y;
    }
  }
  return out;
}

const toLufs = (power: number) => -0.691 + 10 * Math.log10(power);

/** Integrated loudness in LUFS, or -Infinity for silence / audio shorter than one block. */
export function integratedLoudness(channels: Float32Array[], rate: number): number {
  const stages = kWeighting(rate);
  const weighted = channels.map(data => filtered(data, stages));
  const length = weighted[0]?.length ?? 0;
  const block = Math.round(rate * 0.4), hop = Math.round(rate * 0.1);
  const powers: number[] = [];
  for (let start = 0; start + block <= length; start += hop) {
    let sum = 0;
    for (const data of weighted) for (let i = start; i < start + block; i++) sum += data[i] * data[i];
    powers.push(sum / block);
  }
  const loud = powers.filter(p => p > 0 && toLufs(p) > -70);
  if (!loud.length) return -Infinity;
  const relative = toLufs(loud.reduce((a, b) => a + b, 0) / loud.length) - 10;
  const gated = loud.filter(p => toLufs(p) > relative);
  return toLufs(gated.reduce((a, b) => a + b, 0) / gated.length);
}

/** The gain that brings narration to TARGET_LUFS, held back so no sample passes the ceiling. */
export function loudnessGain(channels: Float32Array[], rate: number): number {
  const loudness = integratedLoudness(channels, rate);
  if (!Number.isFinite(loudness)) return 1;
  let peak = 0;
  for (const data of channels) for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  let gain = Math.pow(10, (TARGET_LUFS - loudness) / 20);
  if (peak * gain > PEAK_CEILING) gain = PEAK_CEILING / peak;
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, gain));
}

/** Scales the channels in place to the target loudness; returns the gain used. */
export function normalizeLoudness(channels: Float32Array[], rate: number): number {
  const gain = loudnessGain(channels, rate);
  if (Math.abs(gain - 1) < 0.01) return 1;
  for (const data of channels) for (let i = 0; i < data.length; i++) data[i] *= gain;
  return gain;
}
