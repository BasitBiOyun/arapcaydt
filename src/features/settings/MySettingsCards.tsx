import React, { useEffect, useState } from 'react';
import { CheckCircle, FilePlus, IdentificationCard, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthContext';
import { database } from '../../services/supabase';
import { QUESTION_CATEGORIES, DEFAULT_CATEGORY_ID } from '../../config/categories';
import { cleanPreferences, type UserPreferences } from './preferences';
import { saveMyProfile } from './studioSettings';

export const card = 'p-5 rounded-xl bg-white border border-[#E5E4DC] space-y-4 shadow-xs';
export const field = 'w-full px-3 py-1.5 rounded border border-[#D5D4CC] bg-[#FAF9F5] focus:bg-white text-xs outline-none';
export const primary = 'px-4 py-1.5 rounded bg-[#8B1E2D] hover:bg-[#721824] disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs';

export function CardHeader({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#EFEFEA] pb-3">
      <div className="w-8 h-8 rounded bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center"><Icon size={20} weight="bold" /></div>
      <div>
        <h3 className="text-sm font-semibold text-[#1C1917]">{title}</h3>
        <p className="text-[11px] text-[#787670]">{hint}</p>
      </div>
    </div>
  );
}

export function Result({ notice, error }: { notice?: string; error?: string }) {
  if (error) return <p role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1"><WarningCircle size={14} weight="fill" />{error}</p>;
  if (notice) return <p role="status" className="text-[11px] text-[#1E562A] flex items-center gap-1"><CheckCircle size={14} weight="fill" />{notice}</p>;
  return null;
}

/** Name and password. */
export function ProfileCard() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [nameState, setNameState] = useState<{ notice?: string; error?: string; busy?: boolean }>({});
  const [password, setPassword] = useState(''), [repeat, setRepeat] = useState('');
  const [passState, setPassState] = useState<{ notice?: string; error?: string; busy?: boolean }>({});
  useEffect(() => { if (user?.name) setName(user.name); }, [user?.name]);
  if (!user) return null;

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setNameState({ error: 'Ad boş olamaz.' });
    setNameState({ busy: true });
    try { await saveMyProfile(name, user.preferences || {}); await refresh(); setNameState({ notice: 'Adınız kaydedildi.' }); }
    catch (err: any) { setNameState({ error: err.message }); }
  };
  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setPassState({ error: 'Şifre en az 8 karakter olmalı.' });
    if (password !== repeat) return setPassState({ error: 'Şifreler aynı değil.' });
    setPassState({ busy: true });
    const { error } = await database().auth.updateUser({ password }).catch((err: any) => ({ error: err }));
    if (error) return setPassState({ error: /reauth|recent/i.test(error.message || '') ? 'Güvenlik için çıkış yapıp yeniden giriş yaptıktan sonra tekrar deneyin.' : 'Şifre değiştirilemedi: ' + error.message });
    setPassword(''); setRepeat(''); setPassState({ notice: 'Şifreniz değiştirildi.' });
  };

  return (
    <div className={card}>
      <CardHeader icon={IdentificationCard} title="Profilim" hint={`${user.email} · ${user.title}`} />
      <form onSubmit={saveName} className="space-y-2 text-xs">
        <label className="font-medium text-[#33322E] block" htmlFor="profile-name">Görünen ad</label>
        <div className="flex flex-wrap gap-2">
          <input id="profile-name" className={`${field} !w-auto flex-1 min-w-56`} maxLength={120} value={name} onChange={e => setName(e.target.value)} />
          <button className={primary} disabled={nameState.busy || name.trim() === user.name}>Adı kaydet</button>
        </div>
        <Result {...nameState} />
      </form>
      <form onSubmit={savePassword} className="space-y-2 text-xs border-t border-[#EFEFEA] pt-3">
        <p className="font-medium text-[#33322E]">Şifre değiştir</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <input aria-label="Yeni şifre" type="password" autoComplete="new-password" placeholder="Yeni şifre (en az 8 karakter)" className={field} value={password} onChange={e => setPassword(e.target.value)} />
          <input aria-label="Yeni şifre tekrar" type="password" autoComplete="new-password" placeholder="Yeni şifre tekrar" className={field} value={repeat} onChange={e => setRepeat(e.target.value)} />
        </div>
        <button className={primary} disabled={passState.busy || !password}>Şifreyi değiştir</button>
        <Result {...passState} />
      </form>
    </div>
  );
}

/** What a new question and its video start with. */
export function DefaultsCard() {
  const { user, refresh } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(user?.preferences || {});
  const [state, setState] = useState<{ notice?: string; error?: string; busy?: boolean }>({});
  // Reset only when the saved values change, not on every membership refresh.
  const saved = JSON.stringify(user?.preferences || {});
  useEffect(() => { setPrefs(JSON.parse(saved)); }, [saved]);
  if (!user) return null;
  const set = (patch: UserPreferences) => { setPrefs(p => ({ ...p, ...patch })); setState({}); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true });
    try { await saveMyProfile(user.name, cleanPreferences(prefs)); await refresh(); setState({ notice: 'Varsayılanlar kaydedildi; yeni sorularda kullanılacak.' }); }
    catch (err: any) { setState({ error: err.message }); }
  };

  return (
    <form onSubmit={save} className={card}>
      <CardHeader icon={FilePlus} title="Yeni soru varsayılanları" hint="Yeni soru ve toplu yüklemede bu değerlerle başlanır; her soruda yine değiştirebilirsiniz" />
      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        <label className="space-y-1 block"><span className="font-medium text-[#33322E]">Kategori</span>
          <select className={field} value={prefs.category || DEFAULT_CATEGORY_ID} onChange={e => set({ category: e.target.value })}>
            {QUESTION_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 block"><span className="font-medium text-[#33322E]">Koleksiyon / deneme adı</span>
          <input className={field} maxLength={120} placeholder="Örnek: Eylül Denemesi 1" value={prefs.examName || ''} onChange={e => set({ examName: e.target.value })} />
        </label>
        <label className="space-y-1 block"><span className="font-medium text-[#33322E]">Sınav / yıl</span>
          <input className={field} maxLength={40} placeholder={`${new Date().getFullYear()} YDT`} value={prefs.examYear || ''} onChange={e => set({ examYear: e.target.value })} />
        </label>
      </div>
      <div className="border-t border-[#EFEFEA] pt-3 space-y-2 text-xs text-[#33322E]">
        <p className="font-medium">Video</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.showCaptions !== false} onChange={e => set({ showCaptions: e.target.checked })} /> Altyazıları göster</label>
        <label className="flex items-center gap-2 flex-wrap">
          <span className="w-28">Altyazı konumu</span>
          <input aria-label="Altyazı konumu" type="range" min="0.08" max="0.93" step="0.01" value={prefs.captionY ?? .85} onChange={e => set({ captionY: Number(e.target.value) })} />
          <span className="text-[#787670]">{(prefs.captionY ?? .85) < .4 ? 'üstte' : (prefs.captionY ?? .85) < .7 ? 'ortada' : 'altta'}</span>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.showOutro !== false} onChange={e => set({ showOutro: e.target.checked })} /> Sonda “Doğru cevap” kapanış kartı</label>
      </div>
      <button className={primary} disabled={state.busy}>Varsayılanları kaydet</button>
      <Result {...state} />
    </form>
  );
}
