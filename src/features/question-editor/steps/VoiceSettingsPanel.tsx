import React from 'react';
import type { VoiceSettingsConfig } from '../../../config/voice';

export interface VoiceSettingsPanelProps {
  step: number;
  voiceSettings: VoiceSettingsConfig;
  isGeneratingAudio: boolean;
  sampleBusy: boolean;
  setVoiceSetting: <K extends keyof VoiceSettingsConfig>(key: K, value: VoiceSettingsConfig[K]) => void;
  resetVoiceSettings: () => void;
}

export function VoiceSettingsPanel({ step, voiceSettings, isGeneratingAudio, sampleBusy, setVoiceSetting, resetVoiceSettings }: VoiceSettingsPanelProps) {
  return (
    step===2&&<details className="rounded-xl border border-[#E5E4DC] bg-[#FAF9F5] p-3 text-xs">
      <summary className="cursor-pointer font-semibold text-[#1C1917] flex items-center justify-between gap-3">
        <span>Ses ayarları</span>
        <span className="text-[10px] font-normal text-[#787670]">Hız {voiceSettings.speed.toFixed(2)} · Kararlılık %{Math.round(voiceSettings.stability*100)}</span>
      </summary>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
        <label className="space-y-1.5">
          <div className="flex items-center justify-between"><span className="font-semibold">Hız / tempo</span><span className="font-mono-code">{voiceSettings.speed.toFixed(2)}x</span></div>
          <input type="range" min="0.7" max="1.2" step="0.01" value={voiceSettings.speed}
            disabled={isGeneratingAudio||sampleBusy}
            onChange={e=>setVoiceSetting('speed',Number(e.target.value))}
            className="w-full accent-[#8B1E2D]" />
          <p className="text-[10px] text-[#787670]">0,70 daha yavaş, 1,00 normal, 1,20 daha hızlı.</p>
        </label>
        <label className="space-y-1.5">
          <div className="flex items-center justify-between"><span className="font-semibold">Kararlılık</span><span className="font-mono-code">%{Math.round(voiceSettings.stability*100)}</span></div>
          <input type="range" min="0" max="1" step="0.01" value={voiceSettings.stability}
            disabled={isGeneratingAudio||sampleBusy}
            onChange={e=>setVoiceSetting('stability',Number(e.target.value))}
            className="w-full accent-[#8B1E2D]" />
          <p className="text-[10px] text-[#787670]">Yükseldikçe ton daha tutarlı ve kontrollü olur.</p>
        </label>
        <label className="space-y-1.5">
          <div className="flex items-center justify-between"><span className="font-semibold">Benzerlik</span><span className="font-mono-code">%{Math.round(voiceSettings.similarity_boost*100)}</span></div>
          <input type="range" min="0" max="1" step="0.01" value={voiceSettings.similarity_boost}
            disabled={isGeneratingAudio||sampleBusy}
            onChange={e=>setVoiceSetting('similarity_boost',Number(e.target.value))}
            className="w-full accent-[#8B1E2D]" />
          <p className="text-[10px] text-[#787670]">Ses karakterinin kaynak sese ne kadar yakın tutulacağını belirler.</p>
        </label>
        <label className="space-y-1.5">
          <div className="flex items-center justify-between"><span className="font-semibold">Stil vurgusu</span><span className="font-mono-code">%{Math.round(voiceSettings.style*100)}</span></div>
          <input type="range" min="0" max="1" step="0.01" value={voiceSettings.style}
            disabled={isGeneratingAudio||sampleBusy}
            onChange={e=>setVoiceSetting('style',Number(e.target.value))}
            className="w-full accent-[#8B1E2D]" />
          <p className="text-[10px] text-[#787670]">Yükseltmek ifadeyi artırabilir ama kararlılığı azaltabilir.</p>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-[#E5E4DC]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={voiceSettings.use_speaker_boost}
            disabled={isGeneratingAudio||sampleBusy}
            onChange={e=>setVoiceSetting('use_speaker_boost',e.target.checked)} />
          <span>Speaker Boost</span>
        </label>
        <button type="button" className="studio-secondary" disabled={isGeneratingAudio||sampleBusy} onClick={resetVoiceSettings}>Varsayılana dön</button>
      </div>
    </details>
  );
}
