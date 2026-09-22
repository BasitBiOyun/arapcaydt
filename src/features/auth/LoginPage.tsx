import React,{useState} from 'react';
import {useAuth} from './AuthContext';
import {database,supabase} from '../../services/supabase';
export const LoginPage:React.FC=()=>{
 const {refresh,recovering,finishRecovery,error:authError}=useAuth();
 const [mode,setMode]=useState<'login'|'signup'|'reset'>('login');
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   const client=database();
   if(recovering){const {error}=await client.auth.updateUser({password});if(error)throw error;finishRecovery();setPassword('');await refresh();}
   else if(mode==='signup'){
    const {error}=await client.auth.signUp({email:email.trim(),password,options:{data:{name:name.trim()},emailRedirectTo:window.location.origin}});
    if(error)throw error;setMessage('Doğrulama e-postası gönderildi. Adresinizi doğruladıktan sonra yönetici onayı beklenecek.');setPassword('');
   }else if(mode==='reset'){
    const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});if(error)throw error;
    setMessage('Bu adres kayıtlıysa şifre yenileme bağlantısı gönderildi.');
   }else{const {error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('');await refresh();}
  }catch(err){setError(err instanceof Error?err.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}
 };
 const title=recovering?'Yeni şifre belirle':mode==='signup'?'Öğretmen kaydı':mode==='reset'?'Şifremi unuttum':'Stüdyoya giriş';
 return <main className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6"><div className="w-full max-w-md space-y-6">
  <div><div className="text-4xl text-[#8B1E2D] mb-4">ض</div><h1 className="text-2xl font-bold">Arapça YDT Stüdyosu</h1><p className="text-sm text-stone-500 mt-2">Sorularınız, seslendirmeleriniz ve videolarınız tek yerde.</p></div>
  <form onSubmit={submit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
   <h2 className="font-semibold text-lg">{title}</h2>
   {!supabase&&<p role="alert">Üyelik sistemi kurulumu tamamlanıyor. Lütfen daha sonra tekrar deneyin.</p>}
   {(error||authError)&&<p role="alert" className="text-red-700 text-sm">{error||authError}</p>}
   {message&&<p role="status" className="text-green-800 text-sm">{message}</p>}
   {mode==='signup'&&!recovering&&<label className="block text-sm">Ad soyad<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="block w-full border rounded p-2 mt-1"/></label>}
   {!recovering&&<label className="block text-sm">E-posta<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="block w-full border rounded p-2 mt-1"/></label>}
   {(recovering||mode!=='reset')&&<label className="block text-sm">Şifre<input required type="password" minLength={mode==='signup'||recovering?8:1} autoComplete={mode==='signup'||recovering?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} className="block w-full border rounded p-2 mt-1"/></label>}
   <button disabled={busy||!supabase} className="w-full rounded bg-[#8B1E2D] text-white p-3 disabled:opacity-50">{busy?'İşlem yapılıyor…':title}</button>
   {!recovering&&<div className="flex flex-wrap gap-4 text-sm">{(['login','signup','reset'] as const).filter(m=>m!==mode).map(m=><button type="button" key={m} onClick={()=>{setMode(m);setError('');setMessage('');}}>{m==='login'?'Giriş yap':m==='signup'?'Hesap oluştur':'Şifremi unuttum'}</button>)}</div>}
  </form><p className="text-xs text-stone-500">Yeni öğretmen hesapları, e-posta doğrulaması ve yönetici onayından sonra açılır.</p>
 </div></main>;
};
