import { ExportConfig } from '../../../types';
import { ExportProgress, IVideoExporter } from './types';

export class BrowserVideoExporter implements IVideoExporter {
  private static instance: BrowserVideoExporter;

  public static getInstance(): BrowserVideoExporter {
    if (!BrowserVideoExporter.instance) {
      BrowserVideoExporter.instance = new BrowserVideoExporter();
    }
    return BrowserVideoExporter.instance;
  }

  /**
   * Performs an authentic browser-side video render combining Canvas frames + Web Audio Narration.
   * Produces a real, playable MP4 or WebM video file.
   */
  public async exportVideo(
    canvasRenderer: (ctx: CanvasRenderingContext2D, time: number) => void,
    audioUrl: string | undefined,
    duration: number,
    config: ExportConfig,
    onProgress: (progress: ExportProgress) => void
  ): Promise<Blob> {
    const width = config.resolution === '720p' ? 1280 : 1920;
    const height = config.resolution === '720p' ? 720 : 1080;
    const fps = config.fps || 30;
    const totalSeconds = Math.max(2, duration);
    const totalFrames = Math.ceil(totalSeconds * fps);

    onProgress({
      stage: 'preparing',
      percent: 5,
      message: 'Video tuvali ve ses kanalları hazırlanıyor...',
    });

    // 1. Create Offscreen Canvas for rendering
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const ctx = offscreenCanvas.getContext('2d', { alpha: false });

    if (!ctx) {
      throw new Error('Canvas 2D context could not be created.');
    }

    // 2. Fetch and Decode Audio if available
    let audioBuffer: AudioBuffer | null = null;
    let audioContext: AudioContext | null = null;
    let audioDestination: MediaStreamAudioDestinationNode | null = null;

    if (audioUrl) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContextClass();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioDestination = audioContext.createMediaStreamDestination();
      } catch (err) {
        console.warn('Audio decoding failed or unavailable, continuing video-only render:', err);
      }
    }

    onProgress({
      stage: 'preparing',
      percent: 15,
      message: 'Medya kaydedici başlatılıyor...',
    });

    // 3. Determine best supported video format (Prefer MP4 with H.264/AAC, fallback to WebM)
    const mimeCandidates = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    let chosenMimeType = '';
    for (const mime of mimeCandidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        chosenMimeType = mime;
        break;
      }
    }

    if (!chosenMimeType) {
      chosenMimeType = 'video/webm';
    }

    // 4. Set up Canvas Stream + Audio Stream
    const canvasStream = offscreenCanvas.captureStream(fps);
    const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

    if (audioDestination) {
      const audioTracks = audioDestination.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        combinedTracks.push(audioTracks[0]);
      }
    }

    const combinedStream = new MediaStream(combinedTracks);

    // 5. Initialize MediaRecorder
    const videoBitsPerSecond = config.resolution === '720p' ? 2_500_000 : 4_500_000;
    let mediaRecorder: MediaRecorder;

    try {
      mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: chosenMimeType,
        videoBitsPerSecond,
      });
    } catch {
      // Fallback without mimeType option if browser refuses options
      mediaRecorder = new MediaRecorder(combinedStream);
    }

    const recordedChunks: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    // Return promise that completes when recorder finishes
    return new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onerror = (e) => {
        reject(new Error('MediaRecorder error: ' + (e as any).error?.message));
      };

      mediaRecorder.onstop = () => {
        onProgress({
          stage: 'finalizing',
          percent: 98,
          message: 'Video dosyası paketleniyor...',
        });

        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close().catch(() => {});
        }

        const finalBlob = new Blob(recordedChunks, { type: chosenMimeType });

        onProgress({
          stage: 'completed',
          percent: 100,
          message: 'Video oluşturma başarıyla tamamlandı!',
        });

        resolve(finalBlob);
      };

      // Start recording
      mediaRecorder.start(100);

      // Play audio source through destination node
      let audioSource: AudioBufferSourceNode | null = null;
      if (audioContext && audioBuffer && audioDestination) {
        audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioDestination);
        audioSource.start(0);
      }

      // 6. Frame Rendering Loop
      const frameInterval = 1000 / fps;
      let frameIndex = 0;
      const startTime = performance.now();

      const renderStep = () => {
        const currentTime = frameIndex / fps;

        if (frameIndex >= totalFrames || currentTime >= totalSeconds) {
          onProgress({
            stage: 'encoding',
            percent: 92,
            currentFrame: totalFrames,
            totalFrames,
            message: 'Kareler tamamlandı, ses ve video birleştiriliyor...',
          });

          if (audioSource) {
            try {
              audioSource.stop();
            } catch {}
          }

          // Request last data and stop recorder
          setTimeout(() => {
            try {
              if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
              }
            } catch (err) {
              reject(err);
            }
          }, 200);
          return;
        }

        // Draw this frame deterministically
        canvasRenderer(ctx, currentTime);

        frameIndex++;

        // Report real percentage
        if (frameIndex % 6 === 0 || frameIndex === totalFrames) {
          const percent = Math.min(90, Math.round(15 + (frameIndex / totalFrames) * 75));
          onProgress({
            stage: 'rendering',
            percent,
            currentFrame: frameIndex,
            totalFrames,
            message: `Kareler işleniyor: %${percent} (${frameIndex}/${totalFrames})`,
          });
        }

        // Schedule next frame in sync with realtime playback
        const elapsed = performance.now() - startTime;
        const expectedNextTime = frameIndex * frameInterval;
        const delay = Math.max(0, expectedNextTime - elapsed);

        setTimeout(renderStep, delay);
      };

      // Kick off render loop
      renderStep();
    });
  }
}

export const videoExporter = BrowserVideoExporter.getInstance();
