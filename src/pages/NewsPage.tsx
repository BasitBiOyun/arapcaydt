import { Fragment, useEffect } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { NEWS, markNewsSeen } from '../features/help/changelog';
import { pageHash } from '../layouts/route';

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}</>;
}

/** "Yenilikler": what changed for teachers, newest first, each with a link to its guide. */
export function NewsPage() {
  useEffect(() => { markNewsSeen(); }, []);
  return (
    <div className="studio-library !max-w-3xl space-y-6">
      <header className="library-heading !mb-2">
        <div>
          <h2>Yenilikler</h2>
          <p>Stüdyoya gelen yenilikler ve düzeltmeler, en yenisi üstte.</p>
        </div>
      </header>
      {NEWS.map(entry => (
        <article key={entry.id} className="rounded-xl border border-[#E5E4DC] bg-white p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-[#8B1E2D]">{entry.date}</p>
            <h3 className="text-lg font-bold text-[#1C1917]">{entry.title}</h3>
          </div>
          {entry.groups.map(group => (
            <section key={group.title} className="space-y-2">
              {entry.groups.length > 1 && <h4 className="text-sm font-bold uppercase tracking-wide text-[#787670]">{group.title}</h4>}
              <ul className="space-y-2.5">
                {group.items.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-base leading-relaxed text-[#33322E]">
                    <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B1E2D]" />
                    <span>
                      <Rich text={item.text} />
                      {item.help && (
                        <a href={pageHash('help', item.help)} className="ml-2 inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-[#8B1E2D] hover:underline">
                          Nasıl kullanılır? <ArrowRight size={13} />
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      ))}
    </div>
  );
}
