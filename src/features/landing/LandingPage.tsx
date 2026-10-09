import {
  ArrowRight, BookOpenText, CheckCircle, ClockCounterClockwise, FilmStrip, ImageSquare, Lock, PencilLine,
  Stack, TextAa, Waveform,
} from '@phosphor-icons/react';
import { BrandMark } from '../../components/common/BrandMark';
import { Credit } from '../../components/common/Credit';
import { APP_NAME, APP_OWNER_LINE } from '../../config/brand';
import { DemoPlayer } from './DemoPlayer';
import { useSignupsOpen } from '../settings/studioSettings';

export type AuthMode = 'login' | 'signup';

const STEPS = [
  { icon: ImageSquare, title: 'Soru görselini yükleyin', text: 'Şıklar ve metin otomatik tanınır. A–E yerleşimi yan yana, alt alta ya da ızgara olsun fark etmez.' },
  { icon: PencilLine, title: 'Çözümü yazın', text: 'Elenen şıklar ve doğru cevap yazdığınız çözümden anlaşılır; ayrıca işaretlemeniz gerekmez.' },
  { icon: Waveform, title: 'Seslendirin', text: 'Çözüm doğal bir öğretmen sesiyle okunur ve her kelimenin zamanı çıkarılır.' },
  { icon: FilmStrip, title: "MP4'ü indirin", text: 'İşaretler sesle birlikte çizilir, video doğrudan tarayıcınızda hazırlanır.' },
];

const FEATURES = [
  { icon: CheckCircle, title: 'Sesle birebir senkron', text: 'Bir şık elendiği anda çarpı, doğru cevap söylendiği anda onay işareti düşer.' },
  { icon: TextAa, title: 'Arapçaya saygılı', text: 'Arapça ifadelerin altı harekelerin altından çizilir; görseldeki metin hiç bozulmaz.' },
  { icon: BookOpenText, title: 'İki branş, tek stüdyo', text: 'Arapça ve Din Kültürü soruları aynı sade akışla hazırlanır.' },
  { icon: Stack, title: 'Toplu üretim', text: 'Bir soru setini tek bir çözüm belgesiyle sırayla videoya dönüştürün.' },
  { icon: ClockCounterClockwise, title: 'Kolay düzeltme', text: 'Bir işaret erken mi kaldı? “Biraz geç” deyin, o anı hemen yeniden dinleyin.' },
  { icon: Lock, title: 'Kapalı ve güvenli', text: 'Hesaplar yönetici onayıyla açılır; her öğretmen yalnız kendi sorularını görür, anahtarlar şifreli saklanır.' },
];

/** Public front page for commission members: what the studio does, shown with a live demo. */
export function LandingPage({ onAuth }: { onAuth: (mode: AuthMode) => void }) {
  const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B1E2D] hover:bg-[#721824] text-white font-bold text-sm px-5 py-3 shadow-[0_8px_24px_-8px_rgba(139,30,45,.55)] transition-colors';
  const signups = useSignupsOpen();
  const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5D4CC] bg-white/80 hover:bg-white text-[#1C1917] font-bold text-sm px-5 py-3 transition-colors';

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1C1917] overflow-x-hidden">
      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-[#E5E4DC]/70 bg-[#FAF9F5]/85 backdrop-blur-md">
        <nav className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-3" aria-label="Ana menü">
          <a href="#top" className="flex items-center gap-2.5">
            <BrandMark size={34} />
            <span className="font-bold tracking-tight text-[15px]">{APP_NAME}</span>
          </a>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onAuth('login')} className="text-sm font-semibold px-3 py-2 rounded-lg hover:bg-[#F0EFEA]">Giriş yap</button>
            {signups && <button type="button" onClick={() => onAuth('signup')} className="hidden sm:inline-flex text-sm font-bold px-4 py-2 rounded-lg bg-[#1C1917] hover:bg-[#33312E] text-white">Hesap oluştur</button>}
          </div>
        </nav>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full bg-[#8B1E2D]/10 blur-3xl" />
            <div className="absolute top-40 -left-32 w-[420px] h-[420px] rounded-full bg-[#F2C14E]/15 blur-3xl" />
            <span className="absolute right-[4%] top-8 font-arabic text-[180px] leading-none text-[#8B1E2D]/[0.05] select-none">سُؤَال</span>
          </div>
          <div className="relative max-w-6xl mx-auto px-5 pt-14 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E5D7B0] bg-[#FFF8E6] px-3 py-1 text-xs font-semibold text-[#78540E]">
                <Lock size={13} weight="bold" /> Komisyon üyelerine özel çalışma alanı
              </span>
              <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08]">
                Soru çözümlerinizi, sesle <span className="text-[#8B1E2D]">birebir senkron</span> videolara dönüştürün.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-[#55544F] leading-relaxed max-w-xl">
                Soru görselini yükleyin, çözümü yazın. Seslendirme, işaretler ve MP4 dakikalar içinde hazır. Arapça ve Din Kültürü soruları için.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" onClick={() => onAuth('login')} className={primary}>Stüdyoya giriş yap <ArrowRight size={16} weight="bold" /></button>
                {signups && <button type="button" onClick={() => onAuth('signup')} className={secondary}>Hesap oluştur</button>}
              </div>
              <p className="mt-4 text-xs text-[#787670]">{signups ? 'Yeni hesaplar e-posta doğrulaması ve yönetici onayıyla açılır.' : 'Yeni kayıtlar şu an kapalı; hesabı olan üyeler giriş yapabilir.'}</p>
              <p className="mt-6 pt-5 border-t border-[#E5E4DC] text-sm font-semibold text-[#55544F]">{APP_OWNER_LINE}.</p>
            </div>

            <figure className="relative">
              <div className="rounded-2xl border border-[#E5E4DC] bg-white shadow-[0_30px_80px_-30px_rgba(28,25,23,.35)] overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 h-10 border-b border-[#EFEFEA] bg-[#FAF9F5]">
                  <div className="flex gap-1.5" aria-hidden><span className="w-2.5 h-2.5 rounded-full bg-[#E5E4DC]" /><span className="w-2.5 h-2.5 rounded-full bg-[#E5E4DC]" /><span className="w-2.5 h-2.5 rounded-full bg-[#E5E4DC]" /></div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B1E2D]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B1E2D] animate-pulse" /> Canlı önizleme
                  </span>
                </div>
                <DemoPlayer />
              </div>
              <figcaption className="mt-3 text-xs text-[#787670] text-center">
                Bu video, stüdyonun kendi motoruyla şu anda tarayıcınızda çiziliyor.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-[#E5E4DC] bg-white" aria-labelledby="how">
          <div className="max-w-6xl mx-auto px-5 py-16 lg:py-20">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8B1E2D]">Nasıl çalışır</p>
            <h2 id="how" className="mt-2 text-3xl font-bold tracking-tight">Dört adımda hazır bir çözüm videosu</h2>
            <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl border border-[#E5E4DC] bg-[#FAF9F5] p-5">
                  <span className="absolute top-4 right-5 text-4xl font-bold text-[#8B1E2D]/10 leading-none" aria-hidden>{i + 1}</span>
                  <span className="w-10 h-10 rounded-xl bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center"><s.icon size={22} weight="bold" /></span>
                  <h3 className="mt-4 font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-[#55544F] leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features">
          <div className="max-w-6xl mx-auto px-5 py-16 lg:py-20">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8B1E2D]">Neden {APP_NAME}</p>
            <h2 id="features" className="mt-2 text-3xl font-bold tracking-tight max-w-2xl">Öğretmenin anlatımına sadık, izleyene net videolar</h2>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(f => (
                <div key={f.title} className="rounded-2xl border border-[#E5E4DC] bg-white p-6 hover:shadow-[0_18px_40px_-24px_rgba(28,25,23,.35)] transition-shadow">
                  <f.icon size={26} weight="duotone" className="text-[#8B1E2D]" />
                  <h3 className="mt-4 font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-[#55544F] leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="px-5 pb-16 lg:pb-20">
          <div className="relative max-w-6xl mx-auto overflow-hidden rounded-3xl bg-[#8B1E2D] text-white px-8 py-12 sm:px-12 sm:py-14">
            <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-16 opacity-15"><BrandMark size={260} /></div>
            <div className="relative max-w-xl">
              <h2 className="text-3xl font-bold tracking-tight">Komisyon üyesi misiniz?</h2>
              <p className="mt-3 text-white/80 leading-relaxed">{signups ? 'Hesabınızı oluşturun; e-postanızı doğrulayıp yönetici onayını aldıktan sonra stüdyonuz hazır.' : 'Yeni kayıtlar şu an kapalı. Hesabınız varsa stüdyoya giriş yapabilirsiniz.'}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {signups && <button type="button" onClick={() => onAuth('signup')} className="inline-flex items-center gap-2 rounded-xl bg-white text-[#8B1E2D] hover:bg-[#FFF8E6] font-bold text-sm px-5 py-3 transition-colors">Hesap oluştur <ArrowRight size={16} weight="bold" /></button>}
                <button type="button" onClick={() => onAuth('login')} className="inline-flex items-center gap-2 rounded-xl border border-white/40 hover:bg-white/10 font-bold text-sm px-5 py-3 transition-colors">Giriş yap</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E5E4DC]">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#787670]">
          <div className="flex items-center gap-2">
            <BrandMark size={20} />
            <span>{APP_NAME} · {APP_OWNER_LINE} · {new Date().getFullYear()}</span>
          </div>
          <nav className="flex items-center gap-4" aria-label="Yasal">
            <a href="/gizlilik.html" className="hover:text-[#1C1917]">Gizlilik</a>
            <a href="/kullanim-kosullari.html" className="hover:text-[#1C1917]">Kullanım Koşulları</a>
          </nav>
          <Credit className="text-xs" />
        </div>
      </footer>
    </div>
  );
}
