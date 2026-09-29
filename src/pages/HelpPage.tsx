import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, MagnifyingGlass, Printer, Sparkle } from '@phosphor-icons/react';
import { HELP_TOPICS, helpImage, type HelpTopic } from '../features/help/helpTopics';
import { pageHash, parseHash } from '../layouts/route';

/** **bold** in a help sentence becomes the on-screen name of a button or section. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}</>;
}

const topicFromAddress = () => {
  const wanted = parseHash(window.location.hash).topic;
  return HELP_TOPICS.find(t => t.id === wanted)?.id ?? HELP_TOPICS[0].id;
};

function Topic({ topic }: { topic: HelpTopic }) {
  return (
    <article className="help-topic" aria-labelledby={`help-${topic.id}`}>
      <h2 id={`help-${topic.id}`}>{topic.title}</h2>
      <p className="help-summary"><Rich text={topic.summary} /></p>
      <ol className="help-steps">
        {topic.steps.map((step, i) => (
          <li key={i}>
            <span className="help-step-number" aria-hidden="true">{i + 1}</span>
            <div>
              <p><Rich text={step.text} /></p>
              {step.image && (
                <a href={helpImage(step.image)} target="_blank" rel="noreferrer" title="Büyük görmek için tıklayın">
                  <img src={helpImage(step.image)} alt={step.alt || ''} loading="lazy" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      {topic.tips?.length ? (
        <aside className="help-tips">
          <h3>İpuçları</h3>
          <ul>{topic.tips.map((tip, i) => <li key={i}><Rich text={tip} /></li>)}</ul>
        </aside>
      ) : null}
    </article>
  );
}

/** Illustrated guide: topics on the left, step-by-step pictures on the right; printable as a whole. */
export function HelpPage({ onShowGuide }: { onShowGuide: () => void }) {
  const [topicId, setTopicId] = useState(topicFromAddress);
  const [search, setSearch] = useState('');
  const [printAll, setPrintAll] = useState(false);
  // Back/Forward between topics and links such as #/yardim/google-anahtari.
  useEffect(() => {
    const follow = () => { if (parseHash(window.location.hash).page === 'help') setTopicId(topicFromAddress()); };
    window.addEventListener('popstate', follow);
    window.addEventListener('hashchange', follow);
    return () => { window.removeEventListener('popstate', follow); window.removeEventListener('hashchange', follow); };
  }, []);
  useEffect(() => {
    if (!printAll) return;
    const done = () => setPrintAll(false);
    window.addEventListener('afterprint', done);
    // Pictures load lazily; give them a moment before the print dialog opens.
    const timer = setTimeout(() => window.print(), 600);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', done); };
  }, [printAll]);

  const open = (id: string) => {
    if (id === topicId) return;
    window.history.pushState({ studioPage: 'help' }, '', pageHash('help', id));
    setTopicId(id);
    document.querySelector('.help-content')?.scrollTo({ top: 0 });
    document.querySelector('main')?.scrollTo({ top: 0 });
  };
  const query = search.trim().toLocaleLowerCase('tr');
  const shown = HELP_TOPICS.filter(t => !query || [t.title, t.summary, ...t.steps.map(s => s.text), ...(t.tips || [])].join(' ').toLocaleLowerCase('tr').includes(query));
  const index = HELP_TOPICS.findIndex(t => t.id === topicId);
  const topic = HELP_TOPICS[index];
  const previous = HELP_TOPICS[index - 1], next = HELP_TOPICS[index + 1];

  return (
    <section className={`studio-library help-page ${printAll ? 'print-all' : ''}`}>
      <header className="library-heading help-heading">
        <div>
          <h2>Yardım ve rehber</h2>
          <p>Stüdyoda yapabileceğiniz her şey, resimlerle ve adım adım. Bir konu seçin.</p>
        </div>
        <span className="flex flex-wrap gap-2">
          <button className="studio-secondary" onClick={onShowGuide}><Sparkle size={18} />Tanıtımı yeniden izle</button>
          <button className="studio-secondary" onClick={() => setPrintAll(true)}><Printer size={18} />Rehberi yazdır / PDF</button>
        </span>
      </header>
      <div className="help-layout">
        <nav className="help-menu" aria-label="Yardım konuları">
          <label className="help-search">
            <MagnifyingGlass size={18} />
            <input aria-label="Yardımda ara" placeholder="Konu ara…" value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <select className="help-menu-select" aria-label="Konu seçin" value={topicId} onChange={e => open(e.target.value)}>
            {HELP_TOPICS.map((t, i) => <option key={t.id} value={t.id}>{i + 1}. {t.title}</option>)}
          </select>
          <ul>
            {shown.map(t => (
              <li key={t.id}>
                <button aria-current={t.id === topicId ? 'page' : undefined} onClick={() => open(t.id)}>
                  <span>{HELP_TOPICS.indexOf(t) + 1}</span>{t.title}
                </button>
              </li>
            ))}
            {!shown.length && <li className="help-none">“{search}” için konu bulunamadı.</li>}
          </ul>
        </nav>
        <div className="help-content">
          {printAll ? HELP_TOPICS.map(t => <Topic key={t.id} topic={t} />) : <Topic topic={topic} />}
          {!printAll && (
            <div className="help-pager">
              {previous ? <button className="studio-secondary" onClick={() => open(previous.id)}><ArrowLeft size={18} />{previous.title}</button> : <span />}
              {next && <button className="studio-primary" onClick={() => open(next.id)}>{next.title}<ArrowRight size={18} /></button>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
