import type {QuestionProject} from '../../types';

let connection: Promise<IDBDatabase> | undefined;
function db() {
  return connection ??= new Promise<IDBDatabase>((resolve,reject) => {
    const request = indexedDB.open('arapca-studio-drafts',1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {connection=undefined;reject(request.error);};
  });
}
async function transaction<T>(mode:IDBTransactionMode, run:(store:IDBObjectStore)=>IDBRequest<T>) {
  const database=await db();
  return new Promise<T>((resolve,reject)=>{
    const tx=database.transaction('drafts',mode), request=run(tx.objectStore('drafts'));
    tx.oncomplete=()=>resolve(request.result);
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export const draftStore={
  put:(owner:string,project:QuestionProject)=>transaction('readwrite',s=>s.put(project,`${owner}/${project.id}`)),
  get:(owner:string,id:string)=>transaction<QuestionProject|undefined>('readonly',s=>s.get(`${owner}/${id}`)),
  remove:(owner:string,id:string)=>transaction('readwrite',s=>s.delete(`${owner}/${id}`)),
};
