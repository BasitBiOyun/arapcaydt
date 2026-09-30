import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const REMEMBER = 'studio-remember-me';

/** "Beni hatırla": on (default) keeps the session after the browser closes; off keeps it for this browser session only. */
export function rememberMe(): boolean {
  try { return localStorage.getItem(REMEMBER) !== 'no'; } catch { return true; }
}
export function setRememberMe(remember: boolean) {
  try { localStorage.setItem(REMEMBER, remember ? 'yes' : 'no'); } catch { /* private mode: default applies */ }
}

const sessionStore = {
  getItem: (key: string) => {
    try { return sessionStorage.getItem(key) ?? localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string) => {
    try {
      const [keep, drop] = rememberMe() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      keep.setItem(key, value);
      drop.removeItem(key);
    } catch { /* storage unavailable */ }
  },
  removeItem: (key: string) => {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
  },
};

export const supabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { storage: sessionStore } })
  : null;

export function database() {
  if (!supabase) throw new Error('Üyelik sistemi henüz yapılandırılmadı. Yöneticiye haber verin.');
  return supabase;
}

/** A failure in the teacher's browser, kept for the admin panel. Never throws. */
export function reportClientError(projectId: string, stage: 'isaretler' | 'mp4', error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'bilinmeyen hata');
  if (!supabase) return;
  Promise.resolve(supabase.rpc('record_client_error', { project_id: projectId, stage, message: message.slice(0, 300) }))
    .catch(() => undefined);
}

export async function authHeaders(): Promise<Record<string, string>> {
  const { data, error } = await database().auth.getSession();
  if (error || !data.session) throw new Error('Oturumunuz sona erdi. Yeniden giriş yapın.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

/** Whether "Google ile devam et" is switched on in Supabase (Authentication → Providers). */
export async function googleSignInEnabled(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY } });
    return response.ok && (await response.json())?.external?.google === true;
  } catch {
    return false;
  }
}

/** A failed Google sign-in comes back as ?error_description=… (or in the hash); read it once and tidy the address bar. */
export function takeOAuthError(): string | null {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const description = url.searchParams.get('error_description') || hash.get('error_description');
  if (!description) return null;
  window.history.replaceState(null, '', url.pathname);
  return /database error saving new user/i.test(description)
    ? 'Yeni kayıtlar şu an kapalı.'
    : 'Google ile giriş tamamlanamadı. Tekrar deneyin ya da e-posta ve şifreyle giriş yapın.';
}
