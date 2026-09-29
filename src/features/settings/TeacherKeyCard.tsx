import React, { useEffect, useState } from 'react';
import { Key, Trash, FloppyDisk, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { geminiKeyService, quotaResetClock, type TeacherKeyStatus } from '../../services/narration/geminiKeyService';
import { useConfirm } from '../../components/common/ConfirmDialog';

const badge = (ok: boolean) => `font-semibold px-2.5 py-0.5 rounded-full text-[11px] ${
  ok ? 'bg-[#EFF7F0] text-[#1E562A] border border-[#C5DAC8]' : 'bg-[#FAF5E6] text-[#78540E] border border-[#E5D7B0]'}`;

/** Settings card: the teacher pastes their own Google AI Studio key; it is verified, stored encrypted and never shown again. */
export const TeacherKeyCard: React.FC = () => {
  const confirm = useConfirm();
  const [status, setStatus] = useState<TeacherKeyStatus | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { geminiKeyService.status().then(setStatus, e => setError(e.message)); }, []);

  const run = async (action: () => Promise<TeacherKeyStatus>, done: string) => {
    setBusy(true); setError(''); setNotice('');
    try { setStatus(await action()); setValue(''); setNotice(done); }
    catch (e) { setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  };
  const save = () => run(() => geminiKeyService.save(value), 'Anahtar doğrulandı ve kaydedildi.');
  const remove = async () => {
    if (await confirm({ title: 'Google anahtarınız kaldırılsın mı?', message: 'Sonraki seslendirmeler ortak kapasiteyle yapılır.', confirmLabel: 'Anahtarı kaldır', danger: true })) void run(geminiKeyService.remove, 'Anahtar kaldırıldı.');
  };

  const key = status?.key;
  const today = status?.today;
  const connected = key?.status === 'active';

  return (
    <div className="p-5 rounded-xl bg-white border border-[#E5E4DC] space-y-4 shadow-xs">
      <div className="flex items-center gap-2 border-b border-[#EFEFEA] pb-3">
        <div className="w-8 h-8 rounded bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center">
          <Key size={20} weight="bold" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#1C1917]">Google anahtarım</h3>
          <p className="text-[11px] text-[#787670]">Seslendirme ve kelime zamanları önce sizin ücretsiz Google kotanızdan yapılır</p>
        </div>
      </div>

      <div className="p-3.5 rounded bg-[#FAF9F5] border border-[#E5E4DC] text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[#666560]">Durum:</span>
          <span className={badge(connected)}>
            {!status ? '…' : connected ? `Bağlı · ••••${key!.last4}` : key ? 'Geçersiz · yenileyin' : 'Bağlı değil'}
          </span>
        </div>
        {today && (
          <>
            {key && <div className="flex items-center justify-between">
              <span className="text-[#666560]">Bugün kendi anahtarınızla:</span>
              <span className="text-[#33322E]">
                {today.tts.used}{today.tts.limit ? ` / ${today.tts.limit}` : ''} ses · {today.transcribe.used}{today.transcribe.limit ? ` / ${today.transcribe.limit}` : ''} zamanlama
                {today.transcribe.exhausted ? ' (zamanlama hakkı doldu)' : ''}
              </span>
            </div>}
            <div className="flex items-center justify-between">
              <span className="text-[#666560]">Bugün ortak kapasiteden zamanlama:</span>
              <span className="text-[#33322E]">{today.shared.used}{today.shared.limit != null ? ` / ${today.shared.limit}` : ''}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#666560]">Bugün yedek zamanlama:</span>
              <span className="text-[#33322E]">{today.elevenlabs.used}{today.elevenlabs.limit != null ? ` / ${today.elevenlabs.limit}` : ''}</span>
            </div>
            <p className="text-[#55544F] leading-relaxed text-[11px]">
              Kendi anahtarınızla günde {today.tts.limit ?? 30} ses (3 ses modeli × 10) ve {today.transcribe.limit ?? 25} kelime zamanı ücretsizdir; yani günde yaklaşık {today.tts.limit ?? 30} soru. Bunlar bitince herkesin paylaştığı ortak kapasiteye, kelime zamanları için de yedek servise geçilir. Haklar her gün saat {quotaResetClock()} itibarıyla yenilenir (Türkiye saati). Hepsi dolsa da video üretimi durmaz; zamanlama bilgisayarınızda yapılır.
            </p>
          </>
        )}
      </div>

      {status && !status.storageReady ? (
        <p className="p-3 rounded bg-[#FAF5E6] border border-[#E5D7B0] text-[11px] text-[#78540E]">
          Anahtar kaydı henüz açılmadı; yöneticinin sunucu ayarını tamamlaması bekleniyor.
        </p>
      ) : (
        <div className="space-y-2 text-xs">
          <label className="font-medium text-[#33322E]" htmlFor="teacher-google-key">
            {connected ? 'Anahtarı değiştir:' : 'Anahtarınızı yapıştırın:'}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="teacher-google-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="AI Studio anahtarınızı yapıştırın"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="flex-1 min-w-56 px-3 py-1.5 rounded border border-[#D5D4CC] bg-[#FAF9F5] focus:bg-white text-xs outline-none font-mono-code"
            />
            <button
              onClick={() => void save()}
              disabled={busy || !value.trim()}
              className="px-4 py-1.5 rounded bg-[#8B1E2D] hover:bg-[#721824] disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FloppyDisk size={14} weight="bold" />
              <span>{busy ? 'Doğrulanıyor…' : 'Kaydet'}</span>
            </button>
            {key && (
              <button
                onClick={remove}
                disabled={busy}
                className="px-3 py-1.5 rounded border border-[#D5D4CC] bg-[#FAF9F5] hover:bg-[#F2F1EB] text-xs font-semibold text-[#33322E] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash size={14} />
                <span>Kaldır</span>
              </button>
            )}
          </div>
          {notice && <p className="text-[11px] text-[#1E562A] flex items-center gap-1"><CheckCircle size={14} weight="fill" />{notice}</p>}
          {error && <p className="text-[11px] text-red-600 font-medium flex items-center gap-1"><WarningCircle size={14} weight="fill" />{error}</p>}
        </div>
      )}

      <details className="text-xs text-[#33322E]">
        <summary className="cursor-pointer font-semibold text-[#8B1E2D]">Anahtar nasıl alınır? (2 dakika)</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1 text-[#55544F]">
          <li>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-[#8B1E2D] underline">aistudio.google.com/apikey</a>{' '}
            adresini açın ve kendi Google hesabınızla giriş yapın.
          </li>
          <li>“Create API key” (API anahtarı oluştur) düğmesine basın; sorarsa yeni bir proje oluşturun.</li>
          <li>Oluşan anahtarı kopyalayıp yukarıya yapıştırın ve Kaydet’e basın.</li>
        </ol>
        <p className="mt-2 text-[11px] text-[#6E1623]">
          Faturalandırmayı (billing) açmayın: anahtar ücretsiz kotayla çalışır, size hiçbir ücret yansımaz.
          Anahtarınız yalnızca sizin sorularınız için kullanılır, sunucuda şifreli saklanır ve bir daha gösterilmez.
        </p>
      </details>
    </div>
  );
};
