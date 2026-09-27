import React from 'react';
import type { QuestionProject, VideoConfig } from '../../../types';
import { FilmStrip, Image as ImageIcon } from '@phosphor-icons/react';
import { VideoPreviewCanvas } from '../../video/VideoPreviewCanvas';
import { EditableTimelineUI } from '../../video/EditableTimelineUI';
import { RegionEditorCanvas } from '../RegionEditorCanvas';
import { applyRegionEdits } from '../../../services/analysis/regionEdits';

export interface EditorStageProps {
  videoGenerated: boolean;
  hasImage: boolean;
  previewMode: 'video' | 'image';
  setPreviewMode: (mode: 'video' | 'image') => void;
  step: number;
  editRegions: boolean;
  currentProject: QuestionProject;
  updateCurrentProject: (updates: Partial<QuestionProject>) => void;
  currentPreviewTime: number;
  setCurrentPreviewTime: (time: number) => void;
  isPlayingPreview: boolean;
  setIsPlayingPreview: (playing: boolean) => void;
  activeAudioDuration: number;
  activeAudioUrl: string;
  setIsVideoModalOpen: (open: boolean) => void;
  saveStatus: 'saved' | 'pending' | 'saving' | 'error';
  finishRegionEditing: () => Promise<void>;
  selectedRegionId: string | null;
  setSelectedRegionId: (id: string | null) => void;
  regionHistory: VideoConfig[];
  setRegionHistory: React.Dispatch<React.SetStateAction<VideoConfig[]>>;
}

/** Left column: question image or animated preview, timing editor and box editor. */
export function EditorStage({ videoGenerated, hasImage, previewMode, setPreviewMode, step, editRegions, currentProject, updateCurrentProject, currentPreviewTime, setCurrentPreviewTime, isPlayingPreview, setIsPlayingPreview, activeAudioDuration, activeAudioUrl, setIsVideoModalOpen, saveStatus, finishRegionEditing, selectedRegionId, setSelectedRegionId, regionHistory, setRegionHistory }: EditorStageProps) {
  return (
    <>
    {videoGenerated && hasImage && (
      <div className="absolute top-4 left-6 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-[#E5E4DC] shadow-xs">
        <button
          type="button"
          onClick={() => setPreviewMode('video')}
          className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            previewMode === 'video'
              ? 'bg-[#8B1E2D] text-white shadow-xs'
              : 'text-[#55544F] hover:text-[#1C1917]'
          }`}
        >
          <FilmStrip size={14} weight="bold" />
          <span>Video Önizleme</span>
        </button>
        <button
          type="button"
          onClick={() => setPreviewMode('image')}
          className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            previewMode === 'image'
              ? 'bg-[#8B1E2D] text-white shadow-xs'
              : 'text-[#55544F] hover:text-[#1C1917]'
          }`}
        >
          <ImageIcon size={14} weight="bold" />
          <span>Soru Görseli</span>
        </button>
      </div>
    )}

    <div className="preview-content" hidden={step===3&&editRegions}>
    {previewMode === 'video' && videoGenerated ? (
      /* Generated Video Player powered by local Canvas engine */
      <div className="w-full max-w-4xl flex flex-col gap-4 p-4">
        <VideoPreviewCanvas
          imageUrl={currentProject.imageUrl}
          regions={currentProject.videoConfig.regions}
          actions={currentProject.videoConfig.timelineActions}
          currentTime={currentPreviewTime}
          duration={activeAudioDuration || 15}
          isPlaying={isPlayingPreview}
          onPlayPause={() => setIsPlayingPreview(!isPlayingPreview)}
          onSeek={(t) => setCurrentPreviewTime(t)}
          videoConfig={currentProject.videoConfig}
          audioUrl={activeAudioUrl}
        />
        <div className="flex gap-2 items-center text-xs">
          <label className="flex gap-2 items-center">
          <input type="checkbox" checked={currentProject.videoConfig.showCaptions !== false}
            onChange={e => updateCurrentProject({ videoConfig: { ...currentProject.videoConfig, showCaptions: e.target.checked } })} />
          Altyazıları göster
          </label>
          <input aria-label="Altyazı yüksekliği" type="range" min="0.08" max="0.93" step="0.01"
            value={currentProject.videoConfig.captionY ?? .85}
            onChange={e => updateCurrentProject({ videoConfig: { ...currentProject.videoConfig, captionY: Number(e.target.value) } })} />
          Altyazı konumu
          <label className="flex gap-2 items-center ml-2">
          <input type="checkbox" checked={currentProject.videoConfig.showOutro !== false}
            onChange={e => updateCurrentProject({ videoConfig: { ...currentProject.videoConfig, showOutro: e.target.checked } })} />
          Kapanış kartı
          </label>
        </div>

        <details hidden={step!==3||editRegions} className="w-full text-xs bg-white rounded-xl p-3 border">
          <summary className="cursor-pointer font-semibold text-[#55544F]">Gelişmiş: zaman çizelgesi</summary>
          <EditableTimelineUI duration={activeAudioDuration} currentTime={currentPreviewTime} isPlaying={isPlayingPreview}
            onPlayPause={() => setIsPlayingPreview(!isPlayingPreview)} onSeek={setCurrentPreviewTime}
            regions={currentProject.videoConfig.regions || []} actions={currentProject.videoConfig.timelineActions || []}
            onUpdateActions={actions => updateCurrentProject({ videoConfig: { ...currentProject.videoConfig, timelineActions: actions } })}
            onRequestAutoGenerate={() => setIsVideoModalOpen(true)} keyboardEnabled={step===3&&!editRegions} />
        </details>
      </div>
    ) : hasImage ? (
      /* Large, high-clarity question image preview */
      <div className="w-full flex items-center justify-center">
        <img
          src={currentProject.imageUrl}
          alt="Soru Görseli"
          className="max-h-[calc(100vh-16rem)] max-w-full object-contain rounded-lg border border-[#E5E4DC] bg-white shadow-xs p-2"
        />
      </div>
    ) : (
      /* Initial placeholder */
      <div className="flex flex-col items-center justify-center text-center p-8 max-w-md text-[#8C8A82]">
        <div className="w-16 h-16 rounded-full bg-[#FAF9F5] border border-[#D5D4CC] flex items-center justify-center mb-3 text-[#A8A69E]">
          <ImageIcon size={32} />
        </div>
        <p className="text-xs font-medium text-[#55544F]">
          Soru görseli henüz yüklenmedi
        </p>
        <p className="text-[11px] text-[#8C8A82] mt-1">
          Sağdaki panelden görseli yüklediğinizde burada net ve büyük boyutta görüntülenecektir.
        </p>
      </div>
    )}
    </div>
    {hasImage && step===3 && editRegions && <section className="w-full max-w-4xl shrink-0 text-xs bg-white rounded-xl p-3 border border-[#D5D4CC] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[#E5E4DC]">
        <div>
          <h3 className="font-semibold text-[#1C1917]">Görsel işaretleri düzenle</h3>
          <p className="text-[11px] text-[#787670] mt-0.5">Kutuları, kelime vurgularını ve temel animasyonları doğrudan soru üzerinde düzenleyin.</p>
        </div>
        <div className="flex items-center gap-2">
          <span role="status" className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${
            saveStatus==='saved'
              ? 'bg-[#EFF7F0] border-[#C5DAC8] text-[#1E562A]'
              : saveStatus==='error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-[#FFF7ED] border-[#F1D7AF] text-[#8A5A12]'
          }`}>
            {({saved:'Kaydedildi',pending:'Değişiklikler bekliyor',saving:'Kaydediliyor…',error:'Kayıt hatası'})[saveStatus]}
          </span>
          <button type="button" onClick={()=>void finishRegionEditing()}
            className="px-3 py-2 rounded-lg bg-[#1C1917] hover:bg-[#33312E] text-white text-[11px] font-semibold transition-colors cursor-pointer">
            Düzenlemeyi Bitir ve Önizlemeye Dön
          </button>
        </div>
      </div>
      <RegionEditorCanvas imageUrl={currentProject.imageUrl} regions={currentProject.videoConfig.regions || []}
        solutionText={currentProject.solutionText}
        currentTime={currentPreviewTime}
        audioDuration={activeAudioDuration || 15}
        actions={currentProject.videoConfig.timelineActions || []}
        onUpdateActions={actions=>updateCurrentProject({videoConfig:{...currentProject.videoConfig,timelineActions:actions}})}
        selectedRegionId={selectedRegionId} onSelectRegion={setSelectedRegionId}
        canUndo={regionHistory.length>0} onUndo={()=>{const previous=regionHistory.at(-1);if(previous){updateCurrentProject({videoConfig:previous});setRegionHistory(regionHistory.slice(0,-1));}}}
        onUpdateRegions={regions => {setRegionHistory(h=>[...h.slice(-29),currentProject.videoConfig]);updateCurrentProject({ videoConfig: applyRegionEdits(
          currentProject.videoConfig, regions, currentProject.solutionText,
          currentProject.narrationSource?.words || currentProject.audioNarration?.words || [], activeAudioDuration || 15
        ) });}} />
    </section>}
    </>
  );
}
