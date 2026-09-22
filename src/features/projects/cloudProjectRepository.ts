import { database } from '../../services/supabase';
import { QuestionProject } from '../../types';
import type { IProjectRepository } from './projectRepository';

// Asset references survive reloads; signed URLs are reconstructed only for playback.
const resolvedPaths = new Map<string, string>();
const bucket = () => database().storage.from('project-assets');
async function uploadAsset(url: string, owner: string, project: string) {
  if (resolvedPaths.has(url)) return { assetPath: resolvedPaths.get(url)! };
  if (!url.startsWith('data:') && !url.startsWith('blob:')) return url;
  const blob = await (await fetch(url)).blob();
  if(blob.size>25*1024*1024) throw new Error('Görsel veya ses dosyası 25 MB sınırını aşıyor.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  const path=`${owner}/${project}/${hash}`;
  const {error}=await bucket().upload(path,blob,{contentType:blob.type,upsert:false});
  if(error && (error as any).statusCode!=='409' && (error as any).statusCode!==409 && (error as any).error!=='Duplicate' && error.message!=='The resource already exists') throw error;
  return {assetPath:path};
}
async function resolveAsset(value: any): Promise<string> {
  if(!value || typeof value==='string') return value || '';
  if(typeof value.assetPath!=='string') throw new Error('Dosya kaydı okunamadı.');
  const {data,error}=await bucket().createSignedUrl(value.assetPath,21600);
  if(error) throw error;
  resolvedPaths.set(data.signedUrl,value.assetPath);
  return data.signedUrl;
}
async function hydrate(row: any): Promise<QuestionProject> {
  const p=structuredClone(row.data);
  p.imageUrl=await resolveAsset(p.imageUrl);
  for(const key of ['narrationSource','audioNarration']) if(p[key]) p[key].audioUrl=await resolveAsset(p[key].audioUrl);
  return {...p,id:row.id,ownerId:row.owner_id,createdAt:row.created_at,updatedAt:row.updated_at};
}
async function ownerId(){const {data,error}=await database().auth.getUser();if(error||!data.user)throw new Error('Yeniden giriş yapın.');return data.user.id;}
export class CloudProjectRepository implements IProjectRepository {
  async getAll(){
    const owner=await ownerId();
    const {data,error}=await database().from('projects').select('*').eq('owner_id',owner).order('updated_at',{ascending:false});
    if(error)throw error;return Promise.all(data.map(hydrate));
  }
  async getById(id:string){
    const owner=await ownerId();
    const {data,error}=await database().from('projects').select('*').eq('id',id).eq('owner_id',owner).maybeSingle();
    if(error)throw error;return data?hydrate(data):null;
  }
  async save(project:QuestionProject){
    const owner=await ownerId();
    const p:any=structuredClone(project);
    p.imageUrl=await uploadAsset(p.imageUrl,owner,p.id);
    const uploaded=new Map<string,unknown>();
    for(const key of ['narrationSource','audioNarration']) if(p[key]){
      const url=p[key].audioUrl;
      if(!uploaded.has(url))uploaded.set(url,await uploadAsset(url,owner,p.id));
      p[key].audioUrl=uploaded.get(url);delete p[key].audioBase64;
    }
    delete p.renderedVideoUrl;delete p.ownerId;
    const {data,error}=await database().from('projects').upsert({id:p.id,owner_id:owner,data:p}).select().single();
    if(error)throw error;return hydrate(data);
  }
  async create(data:Omit<QuestionProject,'id'|'createdAt'|'updatedAt'>){
    return this.save({...data,id:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  }
  async delete(id:string){
    const owner=await ownerId();
    const {data,error}=await database().from('projects').delete().eq('id',id).eq('owner_id',owner).select('id');
    if(error)throw error;
    if(!data.length)return false;
    const {data:assets}=await bucket().list(`${owner}/${id}`,{limit:1000});
    if(assets?.length)await bucket().remove(assets.map(a=>`${owner}/${id}/${a.name}`));
    return true;
  }
}
