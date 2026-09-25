import { requireMember, serviceDatabase } from '../../server/auth.js';

export default async function handler(req:any,res:any) {
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({error:'Method not allowed'});
  }

  const member=await requireMember(req,res);
  if(!member)return;
  if(member.profile?.role!=='admin'){
    return res.status(403).json({error:'Yönetici yetkisi gerekli.'});
  }

  const memberId=typeof req.body?.memberId==='string'?req.body.memberId.trim():'';
  const role=req.body?.role;
  if(!/^[0-9a-f-]{36}$/i.test(memberId)||role!=='admin'){
    return res.status(400).json({error:'Geçersiz üye veya rol.'});
  }

  try{
    const db=serviceDatabase();
    const {data:userResult,error:userError}=await db.auth.admin.getUserById(memberId);
    const targetUser=userResult?.user;
    if(userError||!targetUser){
      return res.status(404).json({error:'Üye bulunamadı.'});
    }
    if(!targetUser.email_confirmed_at){
      return res.status(409).json({error:'Bu kişinin e-posta adresi henüz doğrulanmamış. Yönetici yapmadan önce e-posta doğrulaması tamamlanmalı.'});
    }

    const {data:profile,error:profileError}=await db
      .from('profiles')
      .update({role:'admin',status:'approved'})
      .eq('id',memberId)
      .select('id,email,name,role,status')
      .single();

    if(profileError||!profile){
      console.error('[Admin role update]',profileError);
      return res.status(500).json({error:'Yönetici yetkisi kaydedilemedi.'});
    }

    const {error:auditError}=await db.from('activity').insert({
      owner_id:memberId,
      kind:'member_status',
      state:'role_admin',
    });
    if(auditError)console.error('[Admin role audit]',auditError);

    return res.status(200).json({member:profile});
  }catch(error:any){
    console.error('[Admin role endpoint]',error?.message||error);
    return res.status(500).json({error:'Yönetici yetkisi verilirken sunucu hatası oluştu.'});
  }
}
