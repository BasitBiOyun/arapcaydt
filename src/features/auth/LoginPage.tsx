import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { database, googleSignInEnabled, rememberMe, setRememberMe, supabase } from '../../services/supabase';
import { BrandMark } from '../../components/common/BrandMark';
import { APP_NAME, APP_OWNER_LINE } from '../../config/brand';
import { useSignupsOpen } from '../settings/studioSettings';
/** Same rules as Supabase (Authentication → Email): 8+ characters with a-z, A-Z, 0-9 and a symbol. */
export const PASSWORD_HINT = 'En az 8 karakter; küçük harf, büyük harf (A–Z), rakam ve sembol (!, ?, *, . gibi) içermeli.';
export function passwordProblem(password: string): string | null {
  const missing = [
    password.length < 8 && 'en az 8 karakter',
    !/[a-z]/.test(password) && 'küçük harf',
    !/[A-Z]/.test(password) && 'büyük harf (A–Z)',
    !/[0-9]/.test(password) && 'rakam',
    !/[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/.test(password) && 'sembol',
  ].filter(Boolean);
  return missing.length ? `Şifrede eksik: ${missing.join(', ')}.` : null;
}
/** Supabase's English auth errors, in plain Turkish. */
export function authMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-posta ya da şifre hatalı.';
  if (/email not confirmed/i.test(message)) return 'Önce e-postanıza gelen doğrulama bağlantısına tıklayın.';
  if (/already registered|already been registered/i.test(message)) return 'Bu e-postayla zaten bir hesap var. Giriş yapın ya da şifrenizi yenileyin.';
  if (/password/i.test(message) && /(weak|at least|characters|contain)/i.test(message)) return `Şifre yeterince güçlü değil. ${PASSWORD_HINT}`;
  if (/rate limit|too many/i.test(message)) return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.';
  if (/same.*password|different from the old/i.test(message)) return 'Yeni şifre eskisinden farklı olmalı.';
  return message;
}

function GoogleMark() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export const LoginPage: React.FC<{ initialMode?: 'login' | 'signup'; onBack?: () => void; initialError?: string }> = ({
  initialMode = 'login',
  onBack,
  initialError = '',
}) => {
  const { refresh, recovering, finishRecovery, logout, error: authError } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(initialError);
  const [remember, setRemember] = useState(rememberMe);
  const signups = useSignupsOpen();
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    void googleSignInEnabled().then(setGoogle);
  }, []);
  const continueWithGoogle = async () => {
    setBusy(true);
    setError('');
    setRememberMe(remember);
    // Google accounts arrive with a verified address; approval works exactly as for e-mail sign-ups.
    const { error } = await database().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) {
      setError('Google ile giriş başlatılamadı. Biraz sonra tekrar deneyin.');
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!signups && mode === 'signup') {
      setMode('login');
      setError('Yeni kayıtlar şu an kapalı. Hesabınız varsa giriş yapabilirsiniz.');
    }
  }, [signups, mode]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const weak = (recovering || mode === 'signup') && passwordProblem(password);
    if (weak) {
      setError(weak);
      setBusy(false);
      return;
    }
    try {
      const client = database();
      if (recovering) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        finishRecovery();
        setPassword('');
        await refresh();
      } else if (mode === 'signup') {
        const { error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw /database error saving new user/i.test(error.message) ? new Error('Yeni kayıtlar şu an kapalı.') : error;
        setMessage('Doğrulama e-postası gönderildi; bağlantı 1 saat geçerlidir. Adresinizi doğruladıktan sonra yönetici onayı beklenecek.');
        setPassword('');
      } else if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage('Bu adres kayıtlıysa şifre yenileme bağlantısı gönderildi; bağlantı 1 saat geçerlidir.');
      } else {
        setRememberMe(remember);
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setPassword('');
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? authMessage(err.message) : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };
  const title = recovering
    ? 'Yeni şifre belirle'
    : mode === 'signup'
      ? 'Öğretmen kaydı'
      : mode === 'reset'
        ? 'Şifremi unuttum'
        : 'Stüdyoya giriş';
  return (
    <main className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {onBack && !recovering && (
          <button type="button" onClick={onBack} className="text-sm text-[#55544F] hover:text-[#1C1917] inline-flex items-center gap-1.5">
            ← Ana sayfa
          </button>
        )}
        <div>
          <BrandMark size={48} className="mb-4" />
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
          <p className="text-sm text-stone-500 mt-2">{APP_OWNER_LINE}.</p>
        </div>
        <form onSubmit={submit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">{title}</h2>
          {!supabase && <p role="alert">Üyelik sistemi kurulumu tamamlanıyor. Lütfen daha sonra tekrar deneyin.</p>}
          {(error || authError) && (
            <p role="alert" className="text-red-700 text-sm">
              {error || authError}
            </p>
          )}
          {message && (
            <p role="status" className="text-green-800 text-sm">
              {message}
            </p>
          )}
          {google && !recovering && mode !== 'reset' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void continueWithGoogle()}
                className="w-full rounded border border-stone-300 bg-white hover:bg-stone-50 p-3 font-semibold text-sm inline-flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                <GoogleMark /> Google ile devam et
              </button>
              <p className="flex items-center gap-3 text-xs text-stone-500 before:h-px before:flex-1 before:bg-stone-200 after:h-px after:flex-1 after:bg-stone-200">
                ya da e-postayla
              </p>
            </>
          )}
          {mode === 'signup' && !recovering && (
            <label className="block text-sm">
              Ad soyad
              <input
                required
                maxLength={120}
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                className="block w-full border rounded p-2 mt-1"
              />
            </label>
          )}
          {!recovering && (
            <label className="block text-sm">
              E-posta
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="block w-full border rounded p-2 mt-1"
              />
            </label>
          )}
          {(recovering || mode !== 'reset') && (
            <label className="block text-sm">
              Şifre
              <input
                required
                type="password"
                minLength={mode === 'signup' || recovering ? 8 : 1}
                autoComplete={mode === 'signup' || recovering ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="block w-full border rounded p-2 mt-1"
              />
              {(mode === 'signup' || recovering) && <span className="block text-xs text-stone-500 mt-1">{PASSWORD_HINT}</span>}
            </label>
          )}
          {mode === 'login' && !recovering && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              Beni hatırla
              <span className="text-xs text-stone-400">(ortak bilgisayarda işaretlemeyin)</span>
            </label>
          )}
          <button disabled={busy || !supabase} className="w-full rounded bg-[#8B1E2D] text-white p-3 disabled:opacity-50">
            {busy ? 'İşlem yapılıyor…' : title}
          </button>
          {recovering && (
            <button
              type="button"
              className="text-sm"
              onClick={() => {
                setPassword('');
                setError('');
                void logout();
              }}
            >
              Vazgeç, giriş ekranına dön
            </button>
          )}
          {!recovering && (
            <div className="flex flex-wrap gap-4 text-sm">
              {(['login', 'signup', 'reset'] as const)
                .filter(m => m !== mode && (signups || m !== 'signup'))
                .map(m => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setError('');
                      setMessage('');
                    }}
                  >
                    {m === 'login' ? 'Giriş yap' : m === 'signup' ? 'Hesap oluştur' : 'Şifremi unuttum'}
                  </button>
                ))}
            </div>
          )}
        </form>
        <p className="text-xs text-stone-500">
          {signups ? 'Yeni öğretmen hesapları, e-posta doğrulaması ve yönetici onayından sonra açılır.' : 'Yeni kayıtlar şu an kapalı.'}
        </p>
      </div>
    </main>
  );
};
