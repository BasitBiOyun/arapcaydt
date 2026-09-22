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
