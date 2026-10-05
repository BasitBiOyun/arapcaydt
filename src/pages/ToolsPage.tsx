import { ArrowSquareOut, ArrowRight } from '@phosphor-icons/react';
import { pageHash } from '../layouts/route';

/** Preparation tools made by a commission colleague; teachers use them before the studio. They open in a new tab. */
const TOOLS = [
  {
    step: '1',
    title: 'Soru şablonu yerleştirici',
    url: 'https://soru-sablon-yerlestirici.vercel.app/',
    what: 'PowerPoint’teki sorularınızı Bakanlığın soru şablonuna yerleştirir; boyutlandırır, uzun soruları ikiye böler. Gerekirse kesim yerini elle hızlıca düzeltirsiniz.',
    then: 'Hazır soruları resim olarak toplu indirin, sonra stüdyoda **Yeni soru** ile yükleyin.',
  },
  {
    step: '2',
    title: 'Çözüm senaryosu oluşturucu',
    url: 'https://tyt-ayt-dkab-senaryo.vercel.app/',
    what: 'Soruların çözüm metnini (senaryosunu) hazırlamanıza yardım eder. Arapça sorular için de kullanılabilir.',
    then: 'Çıkan metni stüdyoda **2 Metin** adımındaki kutuya yapıştırın.',
  },
];

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

export function ToolsPage() {
  return (
    <div className="studio-library !max-w-3xl space-y-6">
      <header className="library-heading !mb-2">
        <div>
          <h2>Hazırlık araçları</h2>
          <p>Stüdyoya gelmeden önce soru görselinizi ve çözüm metninizi bu araçlarla hazırlayabilirsiniz. Araçlar yeni sekmede açılır.</p>
        </div>
      </header>
      <p className="text-base font-semibold text-[#44423D]">1) Şablona yerleştir → 2) Çözüm metnini hazırla → 3) Stüdyoda videoya dönüştür</p>
      {TOOLS.map(tool => (
        <article key={tool.url} className="rounded-xl border border-[#E5E4DC] bg-white p-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#8B1E2D]/10 text-[#8B1E2D] font-bold inline-flex items-center justify-center shrink-0">{tool.step}</span>
            <h3 className="text-lg font-bold text-[#1C1917]">{tool.title}</h3>
          </div>
          <p className="text-base leading-relaxed text-[#33322E]">{tool.what}</p>
          <p className="text-base leading-relaxed text-[#33322E]"><Rich text={tool.then} /></p>
          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="studio-primary inline-flex">
            Aç <ArrowSquareOut size={18} />
          </a>
        </article>
      ))}
      <a href={pageHash('help', 'hazirlik-araclari')} className="inline-flex items-center gap-1 text-sm font-semibold text-[#8B1E2D] hover:underline">
        Nasıl kullanılır? <ArrowRight size={13} />
      </a>
    </div>
  );
}
