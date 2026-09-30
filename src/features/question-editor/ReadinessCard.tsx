import type { QuestionProject } from '../../types';
import { assessReadiness, ReadinessAction } from './readiness';

const titles = { ready: 'Yayına hazır', check: 'Yayına hazır · kontrol önerilir', blocked: 'Yayından önce düzeltin' };
const tones = {
  ready: 'border-[#C5DAC8] text-[#15803D]',
  check: 'border-amber-200 text-[#B45309]',
  blocked: 'border-red-200 text-red-700',
};
const dots = { ok: 'bg-[#15803D]', warn: 'bg-amber-500', fail: 'bg-red-600' };
const actionLabels: Record<ReadinessAction, string> = {
  regions: 'Görselde düzelt', timing: 'Zamanlamayı aç', regenerate: 'Yeniden hazırla', text: 'Metne git',
};

export function ReadinessCard({ project, onAction }: { project: QuestionProject; onAction: (action: ReadinessAction, letter?: string) => void }) {
  const { level, items } = assessReadiness(project);
  return (
    <section aria-label="Yayın kontrolü" className={`rounded-lg border bg-white p-3 space-y-2 ${tones[level]}`}>
      <h3 className="text-sm font-bold">{titles[level]}</h3>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-2 text-sm text-[#55544F]">
            <span aria-hidden className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dots[item.status]}`} />
            <span className="flex-1">{item.label}</span>
            {item.status !== 'ok' && item.action && (
              <button type="button" onClick={() => onAction(item.action!, item.letter)}
                className="shrink-0 font-semibold text-[#8B1E2D] hover:underline cursor-pointer">
                {item.letter ? `${item.letter} şıkkını görselde göster` : actionLabels[item.action]}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
