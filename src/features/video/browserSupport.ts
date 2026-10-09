/**
 * Whether this browser can make the studio's MP4 (H.264 1080p video + AAC audio, encoded in the
 * browser). Checked when the studio opens, so a teacher on an unsupported browser learns it before
 * writing a script and making a voice, not at the last step.
 */
export const VIDEO_CONFIG_1080: VideoEncoderConfig = {
  codec: 'avc1.640028', width: 1920, height: 1080, framerate: 30, bitrate: 6_000_000,
  latencyMode: 'realtime', avc: { format: 'avc' },
};
export const AUDIO_CONFIG_AAC: AudioEncoderConfig = { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 1, bitrate: 192000 };

export type SupportProblem = 'no-encoder' | 'no-h264' | 'no-aac' | null;

interface Encoders {
  VideoEncoder?: { isConfigSupported(config: VideoEncoderConfig): Promise<{ supported?: boolean }> };
  AudioEncoder?: { isConfigSupported(config: AudioEncoderConfig): Promise<{ supported?: boolean }> };
  VideoFrame?: unknown;
  AudioData?: unknown;
}

export async function videoSupportProblem(scope: Encoders = globalThis as Encoders): Promise<SupportProblem> {
  if (!scope.VideoEncoder || !scope.VideoFrame || !scope.AudioEncoder || !scope.AudioData) return 'no-encoder';
  try {
    if (!(await scope.VideoEncoder.isConfigSupported(VIDEO_CONFIG_1080)).supported) return 'no-h264';
    if (!(await scope.AudioEncoder.isConfigSupported(AUDIO_CONFIG_AAC)).supported) return 'no-aac';
  } catch {
    return 'no-h264';
  }
  return null;
}

/** Phones and tablets (iPad included, which reports itself as a Mac with touch). */
export function isTouchDevice(nav: { userAgent: string; maxTouchPoints?: number } = navigator): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)) return true;
  return /Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1;
}

export function supportMessage(problem: SupportProblem, touch: boolean): string | null {
  if (!problem) return touch
    ? 'Telefon ve tablette stüdyo yavaş çalışabilir ve video indirme yarıda kalabilir. Soruyu bilgisayarda, Chrome ya da Edge ile hazırlamanızı öneririz.'
    : null;
  return 'Bu tarayıcı video (MP4) üretemiyor. Soruyu hazırlayabilirsiniz ama son adımda videoyu indiremezsiniz. Bilgisayarda güncel Chrome ya da Edge ile açın.';
}
