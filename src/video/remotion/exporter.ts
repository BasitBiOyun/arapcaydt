import { renderMediaOnWeb } from '@remotion/web-renderer';
import { YdtQuestionComposition } from './YdtQuestionComposition';
import { YdtVideoProps } from './types';
import {
  REMOTION_COMPOSITION_ID,
  REMOTION_WIDTH,
  REMOTION_HEIGHT,
  REMOTION_FPS,
} from './Root';
import { videoExporter } from '../../features/video/engine/exporter';
import { renderQuestionVideoFrame } from '../../features/video/engine/renderer';
import { AnnotationRegion, VideoAction } from '../../types';

export interface RemotionExportProgress {
  percent: number;
  message?: string;
}

/**
 * Programmatic in-browser export using Remotion's official web-renderer engine.
 * Generates an authentic 1920x1080 30fps MP4 file with question image, animations, and audio.
 */
export async function exportRemotionVideo(
  props: YdtVideoProps,
  onProgress?: (p: RemotionExportProgress) => void
): Promise<Blob> {
  const durationInFrames = Math.max(30, Math.ceil(props.durationInSeconds * REMOTION_FPS));

  onProgress?.({ percent: 5, message: 'Remotion video motoru başlatılıyor...' });

  // 1. Attempt Remotion's native client-side web-renderer (WebCodecs)
  try {
    const result = await renderMediaOnWeb({
      composition: {
        id: REMOTION_COMPOSITION_ID,
        component: YdtQuestionComposition,
        durationInFrames,
        fps: REMOTION_FPS,
        width: REMOTION_WIDTH,
        height: REMOTION_HEIGHT,
      },
      inputProps: props,
      container: 'mp4',
      videoCodec: 'h264',
      onProgress: (prog) => {
        const percent = Math.round((prog.progress || 0) * 100);
        onProgress?.({
          percent: Math.min(99, Math.max(5, percent)),
          message: `MP4 kareleri kodlanıyor (%${percent})...`,
        });
      },
    });

    const blob = await result.getBlob();
    onProgress?.({ percent: 100, message: 'MP4 başarıyla oluşturuldu.' });
    return blob;
  } catch (remotionErr) {
    console.warn(
      'Remotion renderMediaOnWeb encountered an environment limitation, activating fallback pipeline:',
      remotionErr
    );

    // 2. High-performance fallback: render deterministic frames into standard MP4
    onProgress?.({ percent: 10, message: 'Video kareleri derleniyor...' });

    let imgElem: HTMLImageElement | null = null;
    if (props.questionImageUrl) {
      imgElem = new Image();
      imgElem.crossOrigin = 'anonymous';
      imgElem.src = props.questionImageUrl;
      await new Promise((resolve) => {
        if (imgElem!.complete) resolve(true);
        else {
          imgElem!.onload = () => resolve(true);
          imgElem!.onerror = () => resolve(false);
        }
      });
    }

    const legacyRegions: AnnotationRegion[] = props.regions.map((r) => ({
      id: r.id,
      label: r.id,
      type: r.type as any,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
    }));

    const legacyActions: VideoAction[] = props.events.map((e) => ({
      id: e.id,
      start: e.start,
      duration: e.duration || 4,
      targetRegionId: e.targetRegionId,
      type: (e.type === 'dimOthers' ? 'dim-others' : e.type) as any,
    }));

    const renderer = (ctx: CanvasRenderingContext2D, time: number) => {
      renderQuestionVideoFrame(
        ctx,
        REMOTION_WIDTH,
        REMOTION_HEIGHT,
        imgElem,
        legacyRegions,
        legacyActions,
        time,
        {
          width: REMOTION_WIDTH,
          height: REMOTION_HEIGHT,
          aspectRatio: '16:9',
          showWatermark: props.showWatermark,
          teacherTag: props.teacherTag,
          interactiveMode: false,
        }
      );
    };

    return await videoExporter.exportVideo(
      renderer,
      props.audioUrl,
      props.durationInSeconds,
      {
        resolution: '1080p',
        fps: 30,
        format: 'mp4',
        aspectRatio: '16:9',
      },
      (p) => {
        onProgress?.({ percent: p.percent, message: p.message });
      }
    );
  }
}
