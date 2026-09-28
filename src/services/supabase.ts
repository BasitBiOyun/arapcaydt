import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
export const supabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  : null;

export function database() {
  if (!supabase) throw new Error('Üyelik sistemi henüz yapılandırılmadı. Yöneticiye haber verin.');
  return supabase;
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
