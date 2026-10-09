import { getCategoryLabel } from '../../config/categories';
import { Analytics, SectionTitle, card } from './adminShared';

const percent = (part: number, whole: number) => whole ? Math.round((part / whole) * 100) : 0;

/**
 * How often the studio's own marks were right: of the finished questions, how many the teacher
 * finished without touching a mark, and which fixes the others needed. Per question type too, so
 * the types that need the most hand work show up first.
 */
export function MarkAccuracy({ marks }: { marks: NonNullable<Analytics['marks']> }) {
  if (!marks.finished) return (
    <section className={card}>
      <SectionTitle title="Otomatik işaretlerin isabeti" />
      <p className="text-sm text-[#787670]">Henüz tamamlanmış soru yok; ölçüm ilk tamamlanan sorularla başlar.</p>
    </section>
  );
  const fixes: Array<[string, number]> = [
    ['Kutusu kaydırıldı / büyütüldü', marks.moved],
    ['Elle işaret eklendi', marks.added],
    ['Bulunan işaret silindi', marks.removed],
    ['Zamanı kaydırıldı (Erken/Geç)', marks.retimed],
  ];
  const types = Object.entries(marks.byCategory).sort((a, b) => percent(a[1].untouched, a[1].finished) - percent(b[1].untouched, b[1].finished) || b[1].finished - a[1].finished);
  return (
    <section className={card}>
      <SectionTitle title="Otomatik işaretlerin isabeti"
        note="Tamamlanan sorulardan kaçında öğretmen işaretlere hiç dokunmadı. Zaman düzeltmeleri bu sürümden sonra yapılanlardan sayılır." />
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-4">
        <p><span className="text-3xl font-bold tabular-nums text-[#1E562A]">%{percent(marks.untouched, marks.finished)}</span>
          <span className="text-sm text-[#55544F]"> dokunulmadan bitti ({marks.untouched} / {marks.finished})</span></p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#666560]">Düzeltilenlerde ne yapıldı</p>
          {fixes.map(([label, n]) => (
            <div key={label}>
              <div className="flex justify-between text-sm"><span className="text-[#55544F]">{label}</span><strong className="tabular-nums">{n}</strong></div>
              <div className="h-1.5 rounded-full bg-[#F2F1EB] mt-1 overflow-hidden"><div className="h-full bg-[#B45309]" style={{ width: `${percent(n, marks.finished)}%` }} /></div>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold text-[#666560] mb-2">Soru tipine göre (en çok düzeltilen üstte)</p>
          <ul className="divide-y divide-[#EFEFEA] text-sm">
            {types.map(([id, t]) => (
              <li key={id} className="py-1.5 flex justify-between gap-3">
                <span className="truncate">{getCategoryLabel(id)}</span>
                <span className="tabular-nums whitespace-nowrap"><strong>%{percent(t.untouched, t.finished)}</strong> <span className="text-[#787670]">· {t.finished} soru</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
