import { requireMember, serviceDatabase } from '../../server/auth.js';

interface ProjectRow {
  owner_id: string;
  data: Record<string, any> | null;
  updated_at: string;
}

async function readAllProjects(db:any):Promise<ProjectRow[]> {
  const all:ProjectRow[]=[];
  const pageSize=1000;
  for(let from=0;;from+=pageSize){
    const {data,error}=await db
      .from('projects')
      .select('owner_id,data,updated_at')
      .order('updated_at',{ascending:false})
      .range(from,from+pageSize-1);
    if(error)throw error;
    const rows=(data||[]) as ProjectRow[];
    all.push(...rows);
    if(rows.length<pageSize)break;
  }
  return all;
}

export default async function handler(req:any,res:any) {
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }

  const member=await requireMember(req,res);
  if(!member)return;
  if(member.profile?.role!=='admin'){
    return res.status(403).json({error:'Yönetici yetkisi gerekli.'});
  }

  try{
    const rows=await readAllProjects(serviceDatabase());
    const categoryTotals:Record<string,number>={};
    const members:Record<string,{
      categories:Record<string,number>;
      draft:number;
      audioGenerated:number;
      audioApproved:number;
      videoReady:number;
      withAudio:number;
      uploadedAudio:number;
      lastProjectAt:string|null;
    }>={};

    for(const row of rows){
      const project=row.data||{};
      const owner=row.owner_id;
      const category=typeof project.category==='string'&&project.category.trim()?project.category.trim():'belirtilmemis';
      const status=typeof project.status==='string'?project.status:'draft';

      if(!members[owner]){
        members[owner]={
          categories:{},
          draft:0,
          audioGenerated:0,
          audioApproved:0,
          videoReady:0,
          withAudio:0,
          uploadedAudio:0,
          lastProjectAt:null,
        };
      }
      const stats=members[owner];
      stats.categories[category]=(stats.categories[category]||0)+1;
      categoryTotals[category]=(categoryTotals[category]||0)+1;

      if(status==='draft')stats.draft++;
      if(status==='audio_generated')stats.audioGenerated++;
      if(status==='audio_approved')stats.audioApproved++;
      if(status==='video_ready'||project.videoReady===true)stats.videoReady++;
      if(project.narrationSource||project.audioNarration)stats.withAudio++;
      if(project.narrationSource?.type==='uploaded')stats.uploadedAudio++;
      if(!stats.lastProjectAt||new Date(row.updated_at).getTime()>new Date(stats.lastProjectAt).getTime()){
        stats.lastProjectAt=row.updated_at;
      }
    }

    return res.status(200).json({
      totalProjects:rows.length,
      categoryTotals,
      members,
    });
  }catch(error:any){
    console.error('[Admin analytics]',error?.message||error);
    return res.status(500).json({error:'Yönetim istatistikleri hazırlanamadı.'});
  }
}
