import { useRef, useState } from 'react';
import { ArrowCounterClockwise, FileZip, UploadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useProjects } from '../projects/ProjectContext';
import { downloadBackup, openBackupFile } from '../projects/backupActions';
import { useConfirm } from '../../components/common/ConfirmDialog';

/** Backup as one ZIP (questions, pictures, voices) and restore from it. */
export function BackupCard() {
  const { projects, importProjects } = useProjects();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const backup = async () => {
    setError('');
    setBusy('Yedek hazırlanıyor…');
    try {
      const count = await downloadBackup(null, p => setBusy(`Yedek hazırlanıyor… ${p.done} / ${p.total} soru`));
      toast.success(`${count} sorunun yedeği indirildi.`, { description: 'Dosyayı bilgisayarınızda güvenli bir yere taşıyın.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yedek hazırlanamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setBusy('');
    }
  };

  const restore = async (file: File) => {
    setError('');
    setBusy('Yedek okunuyor…');
    try {
      const list = await openBackupFile(file);
      if (!await confirm({
        title: `${list.length} soru geri yüklensin mi?`,
        message: 'Yedekteki sorular hesabınıza eklenir. Hesabınızda zaten olan bir soru silinmez veya değiştirilmez; yedekteki hâli ayrı bir soru olarak eklenir.',
        confirmLabel: 'Geri yükle',
      })) return;
      const count = await importProjects(list, done => setBusy(`Geri yükleniyor… ${done} / ${list.length} soru`));
      toast.success(`${count} soru yedekten geri yüklendi.`, { description: 'Sorularım sayfasında görebilirsiniz.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yedek geri yüklenemedi.');
    } finally {
      setBusy('');
      if (input.current) input.current.value = '';
    }
  };

  return (
    <section className="p-5 rounded-xl bg-white border border-[#E5E4DC] space-y-4 shadow-xs">
      <div className="border-b border-[#EFEFEA] pb-3">
        <h3 className="text-base font-semibold text-[#1C1917] flex items-center gap-2"><FileZip size={20} className="text-[#8B1E2D]" /> Yedekleme</h3>
        <p className="text-sm text-[#55544F] mt-1 leading-relaxed">
          Sorularınız hesabınızda saklanır. Ayrıca bir kopyasını bilgisayarınızda tutmak için yedek alın: tek bir ZIP dosyası
          iner; içinde sorularınız, soru görselleri ve sesleri vardır. Bu dosyayla sorularınızı istediğiniz zaman geri yükleyebilirsiniz.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!!busy || !projects.length} onClick={() => void backup()} className="studio-primary">
          <FileZip size={18} /> Tüm sorularımı yedekle ({projects.length})
        </button>
        <button type="button" disabled={!!busy} onClick={() => input.current?.click()} className="studio-secondary">
          <UploadSimple size={18} /> Yedekten geri yükle
        </button>
        <input ref={input} type="file" accept=".zip,application/zip" className="hidden" aria-label="Yedek ZIP dosyası"
          onChange={e => { const file = e.target.files?.[0]; if (file) void restore(file); }} />
      </div>
      {busy && <p role="status" className="text-sm text-[#55544F] flex items-center gap-2"><ArrowCounterClockwise size={16} className="animate-spin" /> {busy} Sayfayı kapatmayın.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <p className="text-sm text-[#787670]">Yalnız bazı soruları yedeklemek için Sorularım sayfasında soruları seçip “Yedeğini indir” düğmesini kullanın.</p>
    </section>
  );
}
