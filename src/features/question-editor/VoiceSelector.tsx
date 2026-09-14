import React, { useState, useEffect } from 'react';
import { 
  Waveform, 
  ArrowsClockwise, 
  CheckCircle, 
  WarningCircle,
  Microphone,
  Check
} from '@phosphor-icons/react';
import { AudioNarration, ElevenLabsStatus } from '../../types';
import { elevenlabsService } from '../../services/elevenlabs/elevenlabsService';
import { STANDARD_VOICE_CONFIG } from '../../config/voice';

interface VoiceSelectorProps {
  solutionText: string;
  audioNarration?: AudioNarration;
  onAudioGenerated: (narration: AudioNarration) => void;
  onAudioApproved: () => void;
  onRegenerateAudio: () => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  solutionText,
  audioNarration,
  onAudioGenerated,
  onAudioApproved,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ElevenLabsStatus | null>(null);

  useEffect(() => {
    elevenlabsService.checkStatus().then((status) => {
      setApiStatus(status);
    });
  }, []);

  const handleGenerate = async () => {
    if (!solutionText || solutionText.trim().length === 0) {
      setGenerationError('Lütfen seslendirme üretmeden önce soru çözüm metnini yazınız.');
      return;
    }

    setGenerationError(null);
    setIsGenerating(true);

    try {
      // Calls server-side proxy using platform standard voice configuration
      const result = await elevenlabsService.generateNarration({
        text: solutionText,
        voiceId: STANDARD_VOICE_CONFIG.voiceId,
        modelId: STANDARD_VOICE_CONFIG.modelId,
        outputFormat: STANDARD_VOICE_CONFIG.outputFormat,
        voiceSettings: STANDARD_VOICE_CONFIG.voiceSettings,
      });

      // Construct audio data URL from returned MP3 base64
      const audioUrl = `data:${result.mimeType};base64,${result.audioBase64}`;

      const newNarration: AudioNarration = {
        audioUrl,
        audioBase64: result.audioBase64,
        duration: result.durationSeconds,
        voiceId: STANDARD_VOICE_CONFIG.voiceId,
        voiceName: STANDARD_VOICE_CONFIG.name,
        modelId: STANDARD_VOICE_CONFIG.modelId,
        generatedAt: new Date().toISOString(),
        isApproved: false,
        mode: result.mode,
        words: result.words,
        alignment: result.alignment,
        wordAlignments: result.wordAlignments,
      };

      onAudioGenerated(newNarration);
    } catch (err: any) {
      console.error('Error generating ElevenLabs audio:', err);
      // Display the meaningful error message to the teacher
      setGenerationError(err.message || 'ElevenLabs seslendirmesi üretilirken bir hata oluştu.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3.5 p-3.5 rounded border border-[#E2E1D9] bg-[#FAF9F5]">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Microphone size={16} weight="bold" className="text-[#8B1E2D]" />
          <span className="text-xs font-semibold text-[#1C1917]">
            Seslendirme (ElevenLabs)
          </span>
        </div>
        {apiStatus && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
              apiStatus.configured
                ? 'bg-[#EAF5EC] text-[#1E562A] border border-[#C5DAC8]'
                : 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]'
            }`}
          >
            {apiStatus.configured ? (
              <>
                <Check size={11} weight="bold" />
                <span>API Bağlı</span>
              </>
            ) : (
              <>
                <WarningCircle size={11} weight="bold" />
                <span>API Anahtarı Bekleniyor</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* Predefined Platform Voice */}
      <div className="p-3 rounded bg-[#FFFFFF] border border-[#E2E1D9] space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[#666560]">Seslendirici (Voice)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F2F1EB] text-[#55544F] font-semibold">
            Standart Ses
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#8B1E2D]/10 flex items-center justify-center text-[#8B1E2D]">
              <Microphone size={14} weight="bold" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1C1917]">{STANDARD_VOICE_CONFIG.name}</div>
              <div className="text-[10px] text-[#6E6D68]">
                Eleven Multilingual v2 • Türkçe & Arapça
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-mono-code font-medium text-[#1C1917]">
              MP3 • 44.1 kHz
            </div>
            <div className="text-[9px] text-[#8C8A82]">128 kbps • Ortalanmış</div>
          </div>
        </div>

        <p className="text-[10px] text-[#787670] leading-relaxed pt-1 border-t border-[#F0EFEA]">
          Türkçe çözüm açıklamaları ve Arapça gramer kurallarının akıcı telaffuzu için önceden optimize edilmiştir.
        </p>
      </div>

      {/* Error Notice (if API request failed) */}
      {generationError && (
        <div className="p-2.5 rounded bg-[#FDF2F2] border border-[#F8D7DA] text-xs text-[#8B1E2D] flex items-start gap-2">
          <WarningCircle size={16} weight="bold" className="shrink-0 mt-0.5 text-[#B91C1C]" />
          <div className="space-y-0.5">
            <div className="font-bold text-[11px]">Seslendirme Üretilemedi:</div>
            <div className="text-[11px] leading-snug">{generationError}</div>
          </div>
        </div>
      )}

      {/* API Key Missing Notice if unconfigured */}
      {apiStatus && !apiStatus.configured && !generationError && (
        <div className="p-2 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[11px] text-[#92400E] flex items-start gap-1.5">
          <WarningCircle size={14} className="shrink-0 mt-0.5 text-[#D97706]" />
          <div>
            <span>Canlı seslendirme için </span>
            <strong>ELEVENLABS_API_KEY</strong>
            <span> ortam değişkeni gereklidir.</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-0.5">
        {!audioNarration ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2 px-3 rounded bg-[#8B1E2D] hover:bg-[#721824] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            {isGenerating ? (
              <>
                <ArrowsClockwise size={16} className="animate-spin" />
                <span>Seslendiriliyor...</span>
              </>
            ) : (
              <>
                <Waveform size={16} weight="bold" />
                <span>Seslendirme Üret</span>
              </>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 py-2 px-3 rounded border border-[#D5D4CC] bg-[#FFFFFF] hover:bg-[#F5F4EE] text-[#1C1917] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowsClockwise size={14} className={isGenerating ? 'animate-spin' : ''} />
                <span>Yeniden Üret</span>
              </button>

              <button
                type="button"
                onClick={onAudioApproved}
                className={`flex-1 py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  audioNarration.isApproved
                    ? 'bg-[#1E562A] text-white'
                    : 'bg-[#8B1E2D] hover:bg-[#721824] text-white'
                }`}
              >
                <CheckCircle size={15} weight="bold" />
                <span>{audioNarration.isApproved ? 'Ses Onaylandı ✓' : 'Sesi Onayla'}</span>
              </button>
            </div>

            {/* Generated Audio Meta */}
            <div className="p-2 rounded bg-[#FFFFFF] border border-[#E5E4DC] flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-[#55544F]">
                <Waveform size={13} className="text-[#8B1E2D]" />
                <span>Süre: <strong>{audioNarration.duration} sn</strong></span>
              </div>
              <span className="font-mono-code text-[10px] px-1.5 py-0.5 rounded bg-[#F2F1EB] text-[#55544F]">
                {audioNarration.voiceName || 'Eğitmen Sesi'} • 44.1kHz MP3
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
