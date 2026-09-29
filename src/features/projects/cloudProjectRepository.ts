import { database } from '../../services/supabase';
import type { ProjectSummary, QuestionProject } from '../../types';
import type { IProjectRepository } from './projectRepository';
import { SUMMARY_SELECT, imageAssetPath, summaryFromRow } from './projectSummary';

// Asset references survive reloads; signed URLs are reconstructed only for playback.
const resolvedPaths = new Map<string, string>();
const bucket = () => database().storage.from('project-assets');
async function uploadAsset(url: string, owner: string, project: string) {
  if (resolvedPaths.has(url)) return { assetPath: resolvedPaths.get(url)! };
  if (!url.startsWith('data:') && !url.startsWith('blob:')) return url;
  // Built-in sample slides are small inline SVGs; storage does not accept SVG uploads.
  if (url.startsWith('data:image/svg+xml')) return url;
  const blob = await (await fetch(url)).blob();
  if(blob.size>25*1024*1024) throw new Error('Görsel veya ses dosyası 25 MB sınırını aşıyor.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  const path=`${owner}/${project}/${hash}`;
  const {error}=await bucket().upload(path,blob,{contentType:blob.type,upsert:false});
  if(error && (error as any).statusCode!=='409' && (error as any).statusCode!==409 && (error as any).error!=='Duplicate' && error.message!=='The resource already exists') throw error;
  return {assetPath:path};
}
/**
 * A file keeps the link it was given for five of its six hours, so an autosave does not hand the
 * open editor a new image and audio address (which reloads the preview mid-edit).
 */
const SIGNED_SECONDS = 21600, REUSE_MS = 5 * 3600_000;
const signedAt = new Map<string, { url: string; at: number }>();
async function resolveAsset(value: any): Promise<string> {
  if(!value || typeof value==='string') return value || '';
  if(typeof value.assetPath!=='string') throw new Error('Dosya kaydı okunamadı.');
  const recent=signedAt.get(value.assetPath);
  if(recent && Date.now()-recent.at<REUSE_MS) return recent.url;
  const {data,error}=await bucket().createSignedUrl(value.assetPath,SIGNED_SECONDS);
  if(error) throw error;
  resolvedPaths.set(data.signedUrl,value.assetPath);
  signedAt.set(value.assetPath,{url:data.signedUrl,at:Date.now()});
  return data.signedUrl;
}
async function hydrate(row: any): Promise<QuestionProject> {
  const p=structuredClone(row.data);
  p.imageUrl=await resolveAsset(p.imageUrl);
  for(const key of ['narrationSource','audioNarration']) if(p[key]) p[key].audioUrl=await resolveAsset(p[key].audioUrl);
  return {...p,id:row.id,ownerId:row.owner_id,createdAt:row.created_at,updatedAt:row.updated_at};
}
async function ownerId(){const {data,error}=await database().auth.getUser();if(error||!data.user)throw new Error('Yeniden giriş yapın.');return data.user.id;}
/** Signed links for many files in one request (thumbnails); a failed batch falls back to one link per file. */
async function signedLinks(paths: string[]): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 200) {
    const chunk = paths.slice(i, i + 200);
    const { data, error } = await bucket().createSignedUrls(chunk, 21600);
    for (const item of error ? [] : data || []) if (item.path && item.signedUrl && !item.error) links.set(item.path, item.signedUrl);
    for (const path of chunk) if (!links.has(path)) {
      const single = await bucket().createSignedUrl(path, 21600);
      if (single.data?.signedUrl) links.set(path, single.data.signedUrl);
    }
  }
  for (const [path, url] of links) resolvedPaths.set(url, path);
  return links;
}

export class CloudProjectRepository implements IProjectRepository {
  /** Light list for libraries and dashboards: summary fields only, thumbnails signed in one batch. */
  async getSummaries(): Promise<ProjectSummary[]> {
    const owner = await ownerId();
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await database().from('projects').select(SUMMARY_SELECT).eq('owner_id', owner)
        .order('updated_at', { ascending: false }).range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if ((data || []).length < 1000) break;
    }
    const paths = [...new Set(rows.map(r => imageAssetPath(r.imageUrl)).filter((p): p is string => !!p))];
    const signed = await signedLinks(paths);
    return rows.map(row => summaryFromRow(row, signed));
  }
  async getAll(){
    const owner=await ownerId();
    const rows:any[]=[];
    for(let from=0;;from+=1000){
      const {data,error}=await database().from('projects').select('*').eq('owner_id',owner).order('updated_at',{ascending:false}).range(from,from+999);
      if(error)throw error;
      rows.push(...data);
      if(data.length<1000)break;
    }
    return Promise.all(rows.map(hydrate));
  }
  async getById(id:string){
    const owner=await ownerId();
    const {data,error}=await database().from('projects').select('*').eq('id',id).eq('owner_id',owner).maybeSingle();
    if(error)throw error;return data?hydrate(data):null;
  }
  async save(project:QuestionProject){
    const owner=await ownerId();
    if(project.ownerId && project.ownerId!==owner)throw new Error('Hesap değişti. Projeyi kendi hesabınızdan açın.');
    const p:any=structuredClone(project);
    p.imageUrl=await uploadAsset(p.imageUrl,owner,p.id);
    const uploaded=new Map<string,unknown>();
    for(const key of ['narrationSource','audioNarration']) if(p[key]){
      if (typeof p[key].assetPath === 'string' && p[key].assetPath) {
        p[key].audioUrl = { assetPath: p[key].assetPath };
      } else {
        const url=p[key].audioUrl;
        if(!uploaded.has(url))uploaded.set(url,await uploadAsset(url,owner,p.id));
        p[key].audioUrl=uploaded.get(url);
      }
      delete p[key].assetPath;
      delete p[key].audioBase64;
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

/** Read-only viewer; database RLS enforces teacher ownership and admin visibility. */
export async function readProjectForOverview(id:string):Promise<QuestionProject|null>{
 const {data,error}=await database().from('projects').select('*').eq('id',id).maybeSingle();
 if(error)throw error;return data?hydrate(data):null;
}
