import {useState} from 'react';
import {narrationService} from '../../services/narration/narrationService';
import {useProjects} from '../projects/ProjectContext';

export function VoiceSample({text,disabled,onBusy}:{text:string;disabled:boolean;onBusy:(busy:boolean)=>void}) {
  const {saveCurrentProject}=useProjects();
  const [sample,setSample]=useState(text.slice(0,300).replace(/\s+\S*$/,''));
  const [audio,setAudio]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const generate=async()=>{
    if(busy)return;setBusy(true);onBusy(true);setError('');setAudio('');
    try {
      const project=await saveCurrentProject();if(!project)throw new Error('Önce proje kaydedilmelidir.');
      const result=await narrationService.generateNarration({projectId:project.id,text:sample.trim()});
      // Gemini returns a stored file link; the ElevenLabs fallback returns inline audio.
      setAudio(result.audioUrl||(result.audioBase64?`data:${result.mimeType};base64,${result.audioBase64}`:''));
    }catch(e){setError(e instanceof Error?e.message:'Örnek ses oluşturulamadı.');}
    finally{setBusy(false);onBusy(false);}
  };
  return <details className="voice-sample"><summary>Telaffuzu kısa bir örnekle dene</summary>
    <p>Ce, E ve Arapça kelimeleri önce dinleyin. Ana ses kaydınız değişmez.</p>
    <label>Deneme metni<textarea maxLength={350} rows={3} dir="auto" value={sample} disabled={busy} onChange={e=>{setSample(e.target.value);setAudio('');}} /></label>
    <button className="studio-secondary" onClick={()=>void generate()} disabled={busy||disabled||!sample.trim()}>{busy?'Örnek hazırlanıyor…':`Örnek ses üret (${sample.trim().length} karakter)`}</button>
    {error&&<p role="alert">{error}</p>}{audio&&<audio controls src={audio} aria-label="Telaffuz denemesi" />}
  </details>;
}
