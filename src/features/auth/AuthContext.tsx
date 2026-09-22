import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import { database, supabase } from '../../services/supabase';

interface AuthContextType {
  user: User | null; isAuthenticated: boolean; isLoading: boolean; recovering: boolean; error: string;
  refresh: () => Promise<void>; logout: () => Promise<void>; finishRecovery: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user,setUser]=useState<User|null>(null);
  const [isLoading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [recovering,setRecovering]=useState(false);
  const refresh=useCallback(async()=>{
    try {
      if(!supabase) { setUser(null); return; }
      const {data:{user:verified},error:authError}=await supabase.auth.getUser();
      if(authError || !verified) { setUser(null); return; }
      if(!verified.email_confirmed_at) { setUser(null); setError('Önce e-posta adresinizi doğrulayın.'); return; }
      const {data,error}=await supabase.from('profiles').select('*').eq('id',verified.id).single();
      if(error) throw error;
      setUser({id:data.id,email:data.email,name:data.name,title:data.role==='admin'?'Yönetici':'Öğretmen',role:data.role,status:data.status});
      setError('');
    } catch { setUser(null); setError('Üyelik bilgileri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.'); }
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    void refresh();
    const subscription=supabase?.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY') setRecovering(true);
      if(event==='SIGNED_OUT') setUser(null);
      clearTimeout(timer); timer=setTimeout(()=>void refresh(),0);
    });
    const onFocus=()=>void refresh(); window.addEventListener('focus',onFocus);
    const poll=setInterval(()=>void refresh(),60000);
    return()=>{subscription?.data.subscription.unsubscribe();clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',onFocus);};
  },[refresh]);
  const logout=async()=>{setUser(null);setRecovering(false);await database().auth.signOut();};
  return <AuthContext.Provider value={{user,isAuthenticated:!!user,isLoading,error,recovering,refresh,logout,finishRecovery:()=>setRecovering(false)}}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider missing');return value;};
