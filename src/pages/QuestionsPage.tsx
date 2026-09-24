import {useState} from 'react';
import {Plus,Copy,Trash,ArrowRight,MagnifyingGlass} from '@phosphor-icons/react';
import {useProjects} from '../features/projects/ProjectContext';
import {QUESTION_CATEGORIES,getCategoryLabel} from '../config/categories';
import {resumeStep,steps} from '../features/question-editor/workflow';
import type {QuestionProject} from '../types';
import type {AppPage} from '../components/common/AppSidebar';
interface Props {onNavigate:(page:AppPage)=>void;onSelectProject:(id:string)=>void;onNewQuestion:()=>void;}
export function QuestionsPage({onSelectProject,onNewQuestion,onNavigate}:Props){
 const {projects,deleteProjectById,createNewProject,isLoading}=useProjects();
 const [search,setSearch]=useState(''),[category,setCategory]=useState(''),[collection,setCollection]=useState(''),[year,setYear]=useState(''),[status,setStatus]=useState('');
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 const collections=[...new Set(projects.map(p=>p.examName).filter(Boolean))].sort();
 const years=[...new Set(projects.map(p=>p.examYear).filter(Boolean))].sort().reverse();
 const rows=projects.filter(p=>(!category||p.category===category)&&(!collection||p.examName===collection)&&(!year||p.examYear===year)&&(!status||String(resumeStep(p))===status)&&[p.title,p.examName,p.examYear,p.arabicQuestionSnippet,String(p.questionNumber)].join(' ').toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')));
 const duplicate=async(p:QuestionProject)=>{setBusy(p.id);setError('');try{
   let imageUrl='';
   if(p.imageUrl){const response=await fetch(p.imageUrl);if(!response.ok)throw new Error('Görsel kopyalanamadı. Tekrar deneyin.');const blob=await response.blob();imageUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});}
   await createNewProject({title:p.title+' (Kopya)',examYear:p.examYear,examName:p.examName,category:p.category,correctAnswer:p.correctAnswer,imageUrl,imageFileName:p.imageFileName,solutionText:p.solutionText,videoConfig:{...p.videoConfig,annotations:[],regions:[],timelineActions:[],captions:[],warnings:[],suppressedRegionIds:[],pipelineVersion:undefined},audioApproved:false,videoReady:false,status:'draft'});
   onNavigate('editor');
 }catch(e){setError(e instanceof Error?e.message:'Proje kopyalanamadı.');}finally{setBusy('');}};
 const remove=async(p:QuestionProject)=>{if(!confirm(`“${p.title}” silinsin mi?`))return;setBusy(p.id);try{if(!await deleteProjectById(p.id))throw new Error('Silinemedi');}catch{setError('Soru silinemedi. Tekrar deneyin.');}finally{setBusy('');}};
 return <section className="studio-library">
  <header className="library-heading"><div><h2>Soru kütüphanem</h2><p>Sorularınız, koleksiyonlarınız ve kaldığınız yer.</p></div><button className="studio-primary" onClick={onNewQuestion}><Plus size={18}/>Yeni soru</button></header>
  <div className="library-filters"><label className="library-search"><MagnifyingGlass size={20}/><input aria-label="Sorularda ara" placeholder="Başlık, yıl veya Arapça metin ara…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <div className="filter-row"><select aria-label="Koleksiyon" value={collection} onChange={e=>setCollection(e.target.value)}><option value="">Tüm koleksiyonlar</option>{collections.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Sınav yılı" value={year} onChange={e=>setYear(e.target.value)}><option value="">Tüm yıllar</option>{years.map(y=><option key={y}>{y}</option>)}</select><select aria-label="Kategori" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Tüm kategoriler</option>{QUESTION_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select><select aria-label="Hazırlık durumu" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tüm aşamalar</option>{steps.map((s,i)=><option key={s} value={String(i)}>{['Görsel bekliyor','Metin bekliyor','Ses kontrolü','İşaret kontrolü','Video hazır'][i]}</option>)}</select>{(search||collection||year||category||status)&&<button onClick={()=>{setSearch('');setCollection('');setYear('');setCategory('');setStatus('');}}>Filtreleri temizle</button>}</div></div>
  {error&&<p role="alert" className="save-alert">{error}</p>}
  <p className="library-count" role="status">{isLoading?'Sorular yükleniyor…':`${rows.length} soru · Son düzenlenen önce`}</p>
  {!isLoading&&!rows.length&&<div className="library-empty"><h3>{projects.length?'Bu filtrelerde soru bulunamadı':'İlk soru videonuzu hazırlayın'}</h3><p>{projects.length?'Filtreleri değiştirin veya yeni bir soru ekleyin.':'Bir soru görseliyle başlayın. Metin, ses ve işaretleri adım adım tamamlayabilirsiniz.'}</p><button className="studio-primary" onClick={onNewQuestion}>Soru ekle</button></div>}
  <div>{rows.map(p=><article key={p.id} className="question-row"><button className="question-open" disabled={!!busy} onClick={()=>onSelectProject(p.id)}>{p.imageUrl?<img src={p.imageUrl} alt="" loading="lazy"/>:<span className="empty-thumbnail">Soru {p.questionNumber}</span>}<span><strong>{p.title}</strong><small>{p.examName||p.examYear} · {getCategoryLabel(p.category)}</small></span></button><span className="project-stage">{['Görsel bekliyor','Metin bekliyor','Ses kontrolü','İşaret kontrolü','Video hazır'][resumeStep(p)]}</span><div className="row-actions"><button disabled={!!busy} aria-label={`${p.title} projesini çoğalt`} title="Ayarları ve metni kopyala; ses yeniden üretilir" onClick={()=>void duplicate(p)}><Copy size={19}/></button><button disabled={!!busy} aria-label={`${p.title} projesini sil`} onClick={()=>void remove(p)}><Trash size={19}/></button><button className="studio-secondary" disabled={!!busy} onClick={()=>onSelectProject(p.id)}>Devam et<ArrowRight size={16}/></button></div></article>)}</div>
 </section>;
}
