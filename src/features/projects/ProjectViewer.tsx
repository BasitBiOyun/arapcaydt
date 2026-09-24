import {useEffect,useRef,useState} from 'react';
import type {QuestionProject} from '../../types';
import {VideoPreviewCanvas} from '../video/VideoPreviewCanvas';

export function ProjectViewer({project:p,onClose}:{project:QuestionProject;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false);
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  const audio=p.narrationSource||p.audioNarration;
  return <dialog ref={dialog} onCancel={onClose} className="project-viewer" aria-labelledby="viewer-title">
    <header><div><h2 id="viewer-title">{p.title}</h2><p>Öğretmenin kaydettiği içerik · Salt okunur</p></div><button className="studio-secondary" onClick={onClose}>Kapat</button></header>
    {p.imageUrl&&(p.videoConfig.timelineActions?.length?<VideoPreviewCanvas imageUrl={p.imageUrl} regions={p.videoConfig.regions||[]} actions={p.videoConfig.timelineActions} currentTime={time} duration={audio?.duration||120} isPlaying={playing} onPlayPause={()=>setPlaying(v=>!v)} onSeek={setTime} videoConfig={p.videoConfig} audioUrl={audio?.audioUrl}/>:<img src={p.imageUrl} alt="Soru görseli" className="w-full"/>)}
    {!p.videoConfig.timelineActions?.length&&audio?.audioUrl&&<audio controls src={audio.audioUrl} className="w-full my-4"/>}
    <h3 className="font-bold mt-5">Çözüm metni · Doğru cevap {p.correctAnswer}</h3>
    <p dir="auto" className="whitespace-pre-wrap leading-loose text-sm mt-3">{p.solutionText||'Henüz metin eklenmedi.'}</p>
  </dialog>;
}
