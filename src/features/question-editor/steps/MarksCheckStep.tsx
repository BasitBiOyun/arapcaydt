import type { QuestionProject } from '../../../types';
import { pipelineDiagnostics } from '../../../services/pipeline/localVideoPipeline';

export interface MarksCheckStepProps {
  videoGenerated: boolean;
  currentProject: QuestionProject;
}

/** Step 4 text: how the marks were placed, and the teşhis file when they came out wrong. */
export function MarksCheckStep({ videoGenerated, currentProject }: MarksCheckStepProps) {
  return (
    <section className="space-y-3">
      <h2>İşaretleri kontrol edin</h2>
      <p>
        {videoGenerated
          ? 'İşaretler sesinize göre yerleştirildi. Önizlemeyi izleyin; yerinde olmayan bir işareti görselde ya da alttaki zaman şeridinde sürükleyerek düzeltin, yoksa indirmeye geçin.'
          : 'Önce aşağıdaki düğmeyle sesinize uygun işaretleri hazırlayın.'}
      </p>
      {videoGenerated && currentProject.videoConfig.ocrEngine && (
        <p className="text-sm text-[#787670]">
          {currentProject.videoConfig.ocrEngine === 'vision'
            ? 'Görsel Google Vision ile okundu.'
            : `Görsel tarayıcıdaki okuyucuyla okundu${currentProject.videoConfig.ocrNote ? ` (${currentProject.videoConfig.ocrNote})` : ''}.`}
          {currentProject.videoConfig.passageNote && <> {currentProject.videoConfig.passageNote}</>}
        </p>
      )}
      {videoGenerated && pipelineDiagnostics() && (
        <button type="button" className="text-sm font-semibold text-[#8B1E2D] hover:underline"
          title="Görselde okunan kelimeler ve çözüm metni: işaretler yanlış çıktıysa bu dosyayı bize gönderin"
          onClick={() => {
            const blob = new Blob([JSON.stringify(pipelineDiagnostics(), null, 1)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `teshis-${(currentProject.title || 'soru').replace(/[^\p{L}\p{N}]+/gu, '-')}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
          }}>
          Teşhis dosyasını indir
        </button>
      )}
    </section>
  );
}
