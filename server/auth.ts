import {createClient} from '@supabase/supabase-js';

export async function requireMember(req:any,res:any) {
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_ANON_KEY;
  if(!url||!key){res.status(503).json({error:'Üyelik servisi henüz hazır değil.'});return null;}
  const header=req.headers.authorization;
  if(typeof header!=='string'||!/^Bearer \S+$/.test(header)){res.status(401).json({error:'Giriş yapmanız gerekiyor.'});return null;}
  try{
    const client=createClient(url,key,{global:{headers:{Authorization:header}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error}=await client.auth.getUser(header.slice(7));
    if(error||!user?.email_confirmed_at){res.status(401).json({error:'Oturum geçersiz veya e-posta doğrulanmamış.'});return null;}
    const {data:profile,error:profileError}=await client.from('profiles').select('role,status').eq('id',user.id).single();
    if(profileError||profile?.status!=='approved'){res.status(403).json({error:'Yönetici onayı gerekli veya erişiminiz durdurulmuş.'});return null;}
    return {user,profile,client};
  }catch{res.status(503).json({error:'Üyelik servisine ulaşılamadı.'});return null;}
}
export function serviceDatabase(){
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Üyelik sunucu ayarları eksik.');
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
