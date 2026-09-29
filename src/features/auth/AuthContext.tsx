import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import { database, supabase } from '../../services/supabase';
import { cleanPreferences } from '../settings/preferences';

/**
 * A failure of the connection (offline, timeout, server hiccup), not a verdict on the session.
 * The teacher stays signed in through these, so a flaky network never drops a running export.
 */
export function isConnectionFailure(error: unknown): boolean {
  const e = error as { name?: string; message?: string; status?: number } | null;
  if (!e) return false;
  if (e instanceof TypeError || e.name === 'AuthRetryableFetchError' || e.name === 'AbortError') return true;
  if (typeof e.status === 'number' && (e.status === 0 || e.status >= 500)) return true;
  return /failed to fetch|network|load failed|timed? ?out|fetch failed/i.test(e.message || '');
}

interface AuthContextType {
  user: User | null;
  /** The last check could not reach the server; the teacher stays signed in meanwhile. */
  offline: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  recovering: boolean;
  error: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  finishRecovery: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [offline, setOffline] = useState(false);
  const refresh = useCallback(async () => {
    try {
      if (!supabase) {
        setUser(null);
        return;
      }
      const {
        data: { user: verified },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError && isConnectionFailure(authError)) { setOffline(true); return; }
      if (authError || !verified) {
        setUser(null);
        return;
      }
      if (!verified.email_confirmed_at) {
        setUser(null);
        setError('Önce e-posta adresinizi doğrulayın.');
        return;
      }
      const { data, error } = await supabase.from('profiles').select('*').eq('id', verified.id).single();
      if (error) throw error;
      setOffline(false);
      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        title: data.role === 'admin' ? 'Yönetici' : 'Öğretmen',
        role: data.role,
        status: data.status,
        preferences: cleanPreferences(data.preferences),
      });
      setError('');
    } catch (failure) {
      // A dropped connection keeps whoever was signed in; the check runs again on its own.
      if (isConnectionFailure(failure)) { setOffline(true); return; }
      setUser(null);
      setError('Üyelik bilgileri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    void refresh();
    const subscription = supabase?.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setUser(null);
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 0);
    });
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    const poll = setInterval(() => void refresh(), 60000);
    return () => {
      subscription?.data.subscription.unsubscribe();
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [refresh]);
  const logout = async () => {
    setUser(null);
    setRecovering(false);
    await database().auth.signOut();
  };
  return (
    <AuthContext.Provider
      value={{ user, offline, isAuthenticated: !!user, isLoading, error, recovering, refresh, logout, finishRecovery: () => setRecovering(false) }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider missing');
  return value;
};
