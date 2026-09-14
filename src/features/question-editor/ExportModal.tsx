import React, { useState } from 'react';
import { 
  Export, 
  VideoCamera, 
  DownloadSimple, 
  CheckCircle, 
  X, 
  Gear, 
  FilmStrip, 
  Waveform,
  Clock,
  WarningCircle,
  Play
} from '@phosphor-icons/react';
import { QuestionProject, ExportConfig } from '../../types';
import { videoExporter } from '../video/engine/exporter';
import { renderQuestionVideoFrame } from '../video/engine/renderer';
import { ExportProgress } from '../video/engine/types';

interface ExportModalProps {
  project: QuestionProject;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ project, isOpen, onClose }) => {
  // Preset options: Preview (720p) and Final (1080p)
  const [preset, setPreset] = useState<'720p' | '1080p'>('1080p');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress({ stage: 'preparing', percent: 5, message: 'Görsel ve ses kaynakları hazırlanıyor...' });
    setErrorMessage(null);
    setDownloadUrl(null);

    try {
      // Preload image element
      let imgElem: HTMLImageElement | null = null;
      if (project.imageUrl) {
        imgElem = new Image();
        imgElem.crossOrigin = 'anonymous';
        imgElem.src = project.imageUrl;
        await new Promise((resolve) => {
          if (imgElem!.complete) resolve(true);
          else {
            imgElem!.onload = () => resolve(true);
            imgElem!.onerror = () => resolve(false);
          }
        });
      }

      const duration = project.audioNarration?.duration || 15;
      const regions = project.videoConfig.regions || [];
      const actions = project.videoConfig.timelineActions || [];
      const watermarkTag = project.videoConfig.teacherTag || 'Arapça YDT • Soru Çözümü';

      const config: ExportConfig = {
        resolution: preset,
        fps: 30,
        format: 'mp4',
        aspectRatio: project.videoConfig.aspectRatio || '16:9',
      };

      const canvasRenderer = (ctx: CanvasRenderingContext2D, time: number) => {
        renderQuestionVideoFrame(
          ctx,
          ctx.canvas.width,
          ctx.canvas.height,
          imgElem,
          regions,
          actions,
          time,
          {
            width: ctx.canvas.width,
            height: ctx.canvas.height,
            aspectRatio: config.aspectRatio,
            showWatermark: project.videoConfig.showWatermark,
            teacherTag: watermarkTag,
            interactiveMode: false,
          }
        );
      };

      // Execute browser-side video render
      const audioUrl = project.audioNarration?.audioUrl;
      const videoBlob = await videoExporter.exportVideo(
        canvasRenderer,
        audioUrl,
        duration,
        config,
        (p) => setProgress(p)
      );

      const url = URL.createObjectURL(videoBlob);
      const filename = `ydt-question-${project.id}.mp4`;
      setDownloadUrl(url);
      setDownloadFilename(filename);

      // Auto-trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Video export error:', err);
      setErrorMessage(err?.message || 'Tarayıcıda video işlenirken bir hata oluştu.');
      setProgress({ stage: 'error', percent: 0, message: 'İşlem başarısız oldu.' });
    } finally {
      setIsExporting(false);
    }
  };

  const totalAnnotations =
    (project.videoConfig.regions?.length || 0) +
    (project.videoConfig.timelineActions?.length || 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded border border-[#D5D4CC] shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#E5E4DC] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#8B1E2D] text-white flex items-center justify-center shadow-xs">
              <Export size={18} weight="bold" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#1C1917]">
                Tarayıcı İçi Video Çıktı Motoru (MP4 Export)
              </h3>
              <p className="text-[11px] text-[#787670] truncate max-w-xs">
                {project.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 rounded text-[#787670] hover:text-[#1C1917] hover:bg-[#EFEFEA] cursor-pointer disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Architecture note banner */}
          <div className="p-3 rounded bg-[#FAF9F5] border border-[#E5E4DC] flex items-start gap-2.5">
            <FilmStrip size={18} className="text-[#8B1E2D] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-[#1C1917]">
                Yerel İstemci (Browser-Side) Video Üretimi
              </span>
              <p className="text-[#666560] leading-relaxed text-[11px]">
                Video doğrudan bilgisayarınızda HTML5 Canvas ve Web Audio API üzerinden kare kare oluşturulur ve seslendirmeyle birleştirilerek MP4 olarak dışa aktarılır.
              </p>
            </div>
          </div>

          {/* Quality Presets (Requirement 10) */}
          <div className="space-y-2.5 p-3.5 rounded border border-[#E5E4DC] bg-white">
            <div className="font-semibold text-[#1C1917] flex items-center gap-1.5 pb-1 border-b border-[#EFEFEA]">
              <Gear size={14} className="text-[#8B1E2D]" />
              <span>Dışa Aktarma Çözünürlük Kalitesi</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-2.5 rounded border cursor-pointer flex flex-col gap-0.5 transition-all ${
                  preset === '1080p'
                    ? 'border-[#8B1E2D] bg-[#FDF2F2] ring-1 ring-[#8B1E2D]'
                    : 'border-[#D5D4CC] bg-[#FAF9F5] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1C1917]">Final: 1080p FHD</span>
                  <input
                    type="radio"
                    name="exportPreset"
                    checked={preset === '1080p'}
                    onChange={() => setPreset('1080p')}
                    className="accent-[#8B1E2D]"
                  />
                </div>
                <span className="text-[11px] text-[#666560]">1920×1080 • 30 FPS</span>
                <span className="text-[10px] text-[#8B1E2D] font-medium">YouTube & Akıllı Tahta</span>
              </label>

              <label
                className={`p-2.5 rounded border cursor-pointer flex flex-col gap-0.5 transition-all ${
                  preset === '720p'
                    ? 'border-[#8B1E2D] bg-[#FDF2F2] ring-1 ring-[#8B1E2D]'
                    : 'border-[#D5D4CC] bg-[#FAF9F5] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1C1917]">Önizleme: 720p HD</span>
                  <input
                    type="radio"
                    name="exportPreset"
                    checked={preset === '720p'}
                    onChange={() => setPreset('720p')}
                    className="accent-[#8B1E2D]"
                  />
                </div>
                <span className="text-[11px] text-[#666560]">1280×720 • 30 FPS</span>
                <span className="text-[10px] text-[#787670] font-medium">Hızlı Çıktı & Paylaşım</span>
              </label>
            </div>

            {/* Track information */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-[#EFEFEA]">
              <div className="flex items-center gap-1.5 text-[#55544F]">
                <Waveform size={14} className="text-[#8B1E2D]" />
                <span>
                  Ses: <strong>{project.audioNarration ? `${project.audioNarration.duration} sn` : 'Ses Yok'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[#55544F]">
                <Clock size={14} className="text-[#8B1E2D]" />
                <span>
                  Eylemler: <strong>{project.videoConfig.timelineActions?.length || 0} adet</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Progress / Status feedback (Requirement 9: Real progress) */}
          {isExporting && progress && (
            <div className="space-y-2 p-3.5 rounded bg-[#FAF5E6] border border-[#E3D4A8]">
              <div className="flex justify-between text-[11px] font-mono-code text-[#7A5812]">
                <span className="font-bold uppercase tracking-wider">{progress.stage}</span>
                <span className="font-bold">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#E8DFC2] overflow-hidden">
                <div
                  style={{ width: `${progress.percent}%` }}
                  className="h-full bg-[#B48419] transition-all duration-200"
                />
              </div>
              <p className="text-[11px] text-[#7A5812]">
                {progress.message}
              </p>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded bg-[#FDF2F2] border border-[#F8D7DA] text-[#8B1E2D] flex items-center gap-2">
              <WarningCircle size={18} weight="fill" className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Completed State */}
          {downloadUrl && (
            <div className="p-3.5 rounded bg-[#EFF7F0] border border-[#C5DAC8] text-[#1E562A] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} weight="fill" />
                  <span className="font-bold text-xs">Video Başarıyla Oluşturuldu!</span>
                </div>
                <a
                  href={downloadUrl}
                  download={downloadFilename}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#1E562A] hover:bg-[#164420] text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <DownloadSimple size={14} weight="bold" />
                  <span>Tekrar İndir</span>
                </a>
              </div>

              {/* In-modal video preview */}
              <div className="pt-1">
                <video
                  src={downloadUrl}
                  controls
                  className="w-full aspect-video rounded border border-[#C5DAC8] bg-black shadow-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#E5E4DC] bg-[#FAF9F5] flex items-center justify-between">
          <span className="text-[11px] font-mono-code text-[#787670]">
            Format: MP4 (H.264 / AAC)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-3 py-1.5 rounded border border-[#D5D4CC] bg-white hover:bg-[#F2F1EB] text-xs font-medium text-[#33322E] cursor-pointer disabled:opacity-40"
            >
              Kapat
            </button>
            <button
              type="button"
              onClick={handleStartExport}
              disabled={isExporting}
              className="px-4 py-1.5 rounded bg-[#8B1E2D] hover:bg-[#721824] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <VideoCamera size={15} weight="bold" />
              <span>{isExporting ? 'Video İşleniyor...' : 'Render Başlat (MP4)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
