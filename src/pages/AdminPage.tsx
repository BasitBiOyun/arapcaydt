import {readProjectForOverview} from '../features/projects/cloudProjectRepository';
import {ProjectViewer} from '../features/projects/ProjectViewer';
import type {QuestionProject} from '../types';
import {projectRepository} from '../features/projects/projectRepository';
import {useProjects} from '../features/projects/ProjectContext';
import React,{useCallback,useEffect,useState} from 'react';
import {authHeaders,database} from '../services/supabase';
import {getCategoryLabel} from '../config/categories';
interface Member {id:string;email:string;name:string;role:string;status:string;questions:number;mock_questions:number;mock_exams:number;voice_attempts:number;voices:number;characters:number;exports:number;}
interface Overview {members:Member[];projects:Array<{id:string;owner_id:string;title:string;category:string;status:string;updated_at:string}>;activity:Array<{id:string;owner_id:string;kind:string;state:string;characters:number;created_at:string}>;}
interface MemberAnalytics {categories:Record<string,number>;draft:number;audioGenerated:number;audioApproved:number;videoReady:number;withAudio:number;uploadedAudio:number;lastProjectAt:string|null;}
interface Analytics {totalProjects:number;categoryTotals:Record<string,number>;members:Record<string,MemberAnalytics>;}
const statuses:Record<string,string>={pending:'Onay bekliyor',approved:'Onaylı',blocked:'Durduruldu',draft:'Taslak',audio_generated:'Ses hazır',audio_approved:'Ses seçildi',video_ready:'Video hazır'};
export const AdminPage:React.FC=()=>{
 const {loadProjects}=useProjects();
 const [viewing,setViewing]=useState<QuestionProject|null>(null);
 const open=async(id:string)=>{setBusy(true);try{const p=await readProjectForOverview(id);if(!p)throw new Error('Proje bulunamadı.');setViewing(p);}catch(e){setError(e instanceof Error?e.message:'Proje açılamadı.');}finally{setBusy(false);}};
 const [importMessage,setImportMessage]=useState('');
 const importLegacy=async()=>{setBusy(true);try{const {data:{user}}=await database().auth.getUser();if(!user)throw new Error('Yeniden giriş yapın.');const raw=localStorage.getItem('arabic_ydt_teacher_projects_v2')||localStorage.getItem('arabic_ydt_teacher_projects_v1')||'[]';const projects=JSON.parse(raw);if(!Array.isArray(projects))throw new Error('Eski kayıt okunamadı.');let count=0;for(const p of projects){if(!p.id||!p.videoConfig||typeof p.solutionText!=='string')continue;const id=`legacy_${user.id}_${p.id}`;if(await projectRepository.getById(id))continue;await projectRepository.save({...p,id});count++;setImportMessage(`${count} proje aktarıldı…`);}setImportMessage(`${count} eski proje hesabınıza aktarıldı. Tarayıcıdaki kopyalar korundu.`);await loadProjects();await load();}catch(e){setError(e instanceof Error?e.message:'Aktarım tamamlanamadı.');}finally{setBusy(false);}};
 const [data,setData]=useState<Overview|null>(null),[analytics,setAnalytics]=useState<Analytics|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState('');
 const load=useCallback(async()=>{setBusy(true);try{
   const [overviewResult,analyticsResponse]=await Promise.all([
    database().rpc('admin_overview'),
    fetch('/api/admin/analytics',{headers:await authHeaders(),cache:'no-store'}),
   ]);
   if(overviewResult.error)throw overviewResult.error;
   const analyticsPayload=await analyticsResponse.json().catch(()=>null);
   if(!analyticsResponse.ok)throw new Error(analyticsPayload?.error||'Soru tipi istatistikleri alınamadı.');
   setData(overviewResult.data);setAnalytics(analyticsPayload);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Yönetim bilgileri alınamadı.');}finally{setBusy(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const change=async(id:string,status:string)=>{setBusy(true);setMessage('');try{const {error}=await database().rpc('set_member_status',{member_id:id,new_status:status});if(error)throw error;await load();}catch(e){setError(e instanceof Error?e.message:'Değişiklik kaydedilemedi.');}finally{setBusy(false);}};
 const promote=async(member:Member)=>{
  if(!window.confirm(`${member.name || member.email} kullanıcısına tam yönetici yetkisi verilsin mi? Yönetici tüm öğretmenleri ve projeleri görüntüleyebilir, üyelik erişimini yönetebilir.`))return;
  setBusy(true);setMessage('');setError('');
  try{
   const response=await fetch('/api/admin/set-role',{
    method:'POST',
    headers:{'Content-Type':'application/json',...await authHeaders()},
    body:JSON.stringify({memberId:member.id,role:'admin'}),
   });
   const payload=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(payload?.error||`Yönetici yetkisi verilemedi (HTTP ${response.status}).`);
   setMessage(`${member.name || member.email} artık yönetici.`);
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Yönetici yetkisi verilemedi.');}
  finally{setBusy(false);}
 };
 const who=(id:string)=>data?.members.find(m=>m.id===id)?.name||'Öğretmen';
 const categoryEntries=(counts:Record<string,number>|undefined)=>Object.entries(counts||{}).sort((a,b)=>b[1]-a[1]);
 const totalVideoReady=Object.values<MemberAnalytics>(analytics?.members||{}).reduce((sum,m)=>sum+m.videoReady,0);
 const totalUploadedAudio=Object.values<MemberAnalytics>(analytics?.members||{}).reduce((sum,m)=>sum+m.uploadedAudio,0);
 return <section className="p-6 space-y-6 max-w-7xl mx-auto">
  {viewing&&<ProjectViewer project={viewing} onClose={()=>setViewing(null)}/>}
  <div className="flex justify-between items-start"><div><h2 className="text-2xl font-bold">Stüdyo yönetimi</h2><p className="text-stone-500 text-sm mt-1">Üyelik erişimini yönetin, öğretmenlerin üretimlerini görüntüleyin. İçerikler için yönetici onayı gerekmez.</p></div><button disabled={busy} onClick={()=>void load()} className="border rounded px-4 py-2">{busy?'Yükleniyor…':'Yenile'}</button></div>
  {error&&<p role="alert" className="bg-red-50 text-red-800 p-3 rounded">{error}</p>}
  {message&&<p role="status" className="bg-green-50 text-green-800 p-3 rounded">{message}</p>}
  <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{[['Öğretmen',data?.members.filter(m=>m.role==='teacher').length||0],['Onay bekleyen',data?.members.filter(m=>m.status==='pending').length||0],['Soru',analytics?.totalProjects??data?.members.reduce((s,m)=>s+m.questions,0)??0],['Üretilen ses',data?.members.reduce((s,m)=>s+m.voices,0)||0],['Video hazır',totalVideoReady],['Yüklenen MP3',totalUploadedAudio]].map(([label,value])=><div key={label} className="bg-white border rounded-xl p-5"><p className="text-sm text-stone-500">{label}</p><strong className="text-3xl">{value}</strong></div>)}</div>
  {analytics&&<section className="bg-white border rounded-xl p-4"><div className="flex items-center justify-between gap-3 mb-3"><div><h3 className="font-semibold">Soru tipi dağılımı</h3><p className="text-xs text-stone-500 mt-1">Tüm öğretmenlerin kaydettiği projeler, soru tipine göre.</p></div><span className="text-xs text-stone-500">{Object.keys(analytics.categoryTotals).length} aktif tip</span></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{categoryEntries(analytics.categoryTotals).map(([id,count])=><div key={id} className="border rounded-lg px-3 py-2 flex items-center justify-between gap-3"><span className="text-sm">{getCategoryLabel(id)}</span><strong className="font-mono-code">{count}</strong></div>)}</div></section>}
  <details className="bg-white border rounded-xl p-4 text-sm"><summary>Eski tarayıcı kayıtlarım</summary><p className="my-3">Önceki sürümde bu tarayıcıya kaydettiğiniz projeleri kendi yönetici hesabınıza aktarın. Daha önce aktarılanlar tekrar eklenmez.</p><button disabled={busy} className="border rounded p-2" onClick={()=>void importLegacy()}>Eski projelerimi aktar</button>{importMessage&&<p role="status" className="mt-2">{importMessage}</p>}</details>
  <section className="bg-white border rounded-xl overflow-hidden"><div className="p-4 flex flex-wrap justify-between gap-3"><h3 className="font-semibold">Üyeler ve üretim</h3><input aria-label="Öğretmen ara" placeholder="Ad veya e-posta ara" value={filter} onChange={e=>setFilter(e.target.value)} className="border rounded p-2 text-sm"/></div>
   <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-stone-50"><tr>{['Öğretmen','Rol','Durum','Sorular','Soru tipleri','Video hazır','Ses / deneme','İstenen karakter','Video dışa aktarım','Son çalışma','Erişim'].map(t=><th key={t} className="p-3 whitespace-nowrap">{t}</th>)}</tr></thead><tbody>{data?.members.filter(m=>(m.name+' '+m.email).toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr'))).map(m=>{const stats=analytics?.members[m.id];const types=categoryEntries(stats?.categories);return <tr key={m.id} className="border-t align-top"><td className="p-3"><div>{m.name}</div><div className="text-xs text-stone-500">{m.email}</div></td><td className="p-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${m.role==='admin'?'bg-[#F8EEEE] text-[#8B1E2D]':'bg-stone-100 text-stone-600'}`}>{m.role==='admin'?'Yönetici':'Öğretmen'}</span></td><td className="p-3">{statuses[m.status]||m.status}</td><td className="p-3 font-semibold">{m.questions}</td><td className="p-3 min-w-64">{types.length?<details><summary className="cursor-pointer text-[#8B1E2D] font-semibold">{types.length} tip · ayrıntı</summary><div className="mt-2 space-y-1">{types.map(([id,count])=><div key={id} className="flex items-center justify-between gap-3 text-xs"><span>{getCategoryLabel(id)}</span><strong>{count}</strong></div>)}</div></details>:<span className="text-stone-400">Henüz soru yok</span>}</td><td className="p-3">{stats?.videoReady||0}</td><td className="p-3"><div className="font-semibold">{m.voices} başarılı</div><div className="text-xs text-stone-500">{m.voice_attempts} deneme</div></td><td className="p-3">{m.characters.toLocaleString('tr')}</td><td className="p-3">{m.exports}</td><td className="p-3 whitespace-nowrap text-xs">{stats?.lastProjectAt?new Date(stats.lastProjectAt).toLocaleString('tr'):'-'}</td><td className="p-3">{m.role!=='admin'?<div className="flex flex-wrap gap-2 items-center"><select aria-label={`${m.email} erişimi`} disabled={busy} value={m.status} onChange={e=>void change(m.id,e.target.value)} className="border rounded p-2"><option value="pending">Onay bekliyor</option><option value="approved">Onayla</option><option value="blocked">Durdur</option></select><button type="button" disabled={busy} onClick={()=>void promote(m)} className="border border-[#8B1E2D] text-[#8B1E2D] hover:bg-[#F8EEEE] rounded px-3 py-2 font-semibold whitespace-nowrap">Yönetici Yap</button></div>:<span className="text-xs text-stone-500">Tam yetki</span>}</td></tr>})}</tbody></table></div>
   <p className="text-xs text-stone-500 p-4">Soru tipi dağılımı tüm kayıtlı projelerden hesaplanır. Ses denemelerine başarısız istekler dahildir. Karakter sayısı fatura tutarı değildir. Video dışa aktarım sayısı tarayıcının bildirdiği tamamlanan dışa aktarımlardır.</p></section>
  <section className="bg-white border rounded-xl p-4"><h3 className="font-semibold mb-3">Son 100 soru projesi</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['Proje','Öğretmen','Tür','Durum','Güncelleme'].map(t=><th className="p-2" key={t}>{t}</th>)}</tr></thead><tbody>{data?.projects.map(p=><tr key={p.id} className="border-t"><td className="p-2"><button disabled={busy} className="text-[#8b1e2d] underline text-left" onClick={()=>void open(p.id)}>{p.title}</button></td><td className="p-2">{who(p.owner_id)}</td><td className="p-2">{getCategoryLabel(p.category)}</td><td className="p-2">{statuses[p.status]||p.status}</td><td className="p-2">{new Date(p.updated_at).toLocaleString('tr')}</td></tr>)}</tbody></table></div></section>
  <section className="bg-white border rounded-xl p-4"><h3 className="font-semibold mb-3">Son 100 işlem</h3><ul className="divide-y text-sm">{data?.activity.map(a=><li key={a.id} className="py-2">{who(a.owner_id)} · {a.kind==='voice'?'Ses üretimi':a.kind==='video_export'?'Video dışa aktarımı':a.kind==='member_role'?'Rol değişikliği':'Üyelik'} · {({succeeded:'Tamamlandı',requested:'İstek gönderildi',failed:'Başarısız',uncertain:'Sonuç doğrulanamadı',client_reported:'Tarayıcıda tamamlandı',role_admin:'Yönetici yapıldı',...statuses} as Record<string,string>)[a.state]||a.state} <span className="text-stone-400">{new Date(a.created_at).toLocaleString('tr')}</span></li>)}</ul></section>
 </section>;
};
