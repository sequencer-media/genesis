import {genesisDispatchOrder} from './scheduling.js';
import {genesisRequiredFrameStatus} from './frameLibrary.js';
import type {GenesisState, GenesisJob} from './genesisCore.js';

/** Public display metadata supplied only after an action is committed. */
export interface GenesisQueuePlanItem {
 id:string; label:string; prompt?:string; actionId?:string; jobId?:string;
 status?:'queued'|'preparing'|'playing'; durationMs?:number;
}
/** Trusted host observations of generated stream chunks, including automatic continuation. */
export interface GenesisStreamChunk {
 id:string;label:string;prompt?:string;jobId?:string;sequence:number;
 source?:'action'|'genesis';status:'queued'|'preparing'|'playing';durationMs:number;estimatedStartAt:number|null;
}
export interface GenesisQueueView {
 version:1; revision:number; serverNow:number; estimated:true;
 cancelledItems:Array<{id:string;jobId:string|null;label:string;prompt:string|null;status:'cancelled';supersededBy:string;cancelledAt:number}>;
 items:Array<{id:string; jobId:string|null; actionId:string|null; kind:string; label:string; prompt:string|null; position:number;
  source:'action'|'genesis';chunkSequence:number|null; status:'queued'|'preparing'|'playing'; waitingForFrame?:boolean; queuedAt:number|null; durationMs:number;
  estimatedStartAt:number|null; estimatedEndAt:number|null; estimatedWaitMs:number|null;
  priority:'urgent'|'queued'|'mergeable';targetStartAt:number|null;targetLatencyMs:number|null;
  targetStatus:'unknown'|'on-track'|'at-risk'|'missed'|'playing';mergedEffectIds:string[];mergedActions:Array<{id:string;label:string;prompt:string|null;actionId:string|null}>}>;
}
const safe=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
export function validateGenesisQueuePlan(input:unknown,previous:GenesisState['queuePlan'],now:number):NonNullable<GenesisState['queuePlan']>{
 if(!Array.isArray(input)||input.length>32||JSON.stringify(input).length>24000)throw Error('Use a public queue plan with at most 32 entries and 24 KB.');
 const seen=new Set<string>();
 return input.map(item=>{
  if(!item||Object.keys(item).some(k=>!['id','label','prompt','actionId','jobId','status','durationMs'].includes(k))||!safe(item.id)||seen.has(item.id)
   ||typeof item.label!=='string'||!item.label.trim()||item.label.length>100
   ||item.prompt!==undefined&&(typeof item.prompt!=='string'||item.prompt.length>2000)
   ||item.actionId!==undefined&&!safe(item.actionId)||item.jobId!==undefined&&!safe(item.jobId)
   ||item.status!==undefined&&!['queued','preparing','playing'].includes(item.status)
   ||item.durationMs!==undefined&&(!Number.isInteger(item.durationMs)||item.durationMs<1000||item.durationMs>120000))throw Error('Use unique queue IDs, public labels/prompts and valid timing metadata.');
  seen.add(item.id);return {...item,label:item.label.trim(),queuedAt:previous?.find(p=>p.id===item.id)?.queuedAt??now};
 });
}
/** Unknown or overdue estimates stay null until the host observes fresh stream progress. */
export function genesisQueueView(state:GenesisState,timing:{now?:number;durationMs?:number;gapMs?:number;firstStartsAt?:number|null;playingJobId?:string;playingStartedAt?:number;chunks?:GenesisStreamChunk[]}={}):GenesisQueueView {
 const now=timing.now??Date.now(),duration=Math.max(1000,timing.durationMs||14375);
 const plans=(state.queuePlan||[]).map(p=>{
  const owner=state.jobs.find(j=>j.mergedEffects?.some(e=>e.id===(p.jobId||p.id)));
  return owner?{...p,jobId:owner.id}:p;
 }).filter((p,i,all)=>all.findIndex(x=>(x.jobId||x.id)===(p.jobId||p.id))===i);
 const playing=(j:GenesisJob)=>['queued','running'].includes(j.status)&&(j.id===timing.playingJobId||!!j.playbackStartedAt)||j.effect.type==='scene.request'&&state.stage.mode==='playing'&&j.result?.videoUrl===state.stage.videoUrl;
 const active=[...state.jobs.filter(j=>j.status==='ready'&&playing(j)),...genesisDispatchOrder(state)].filter(j=>!j.effect.frame&&(['queued','running'].includes(j.status)||j.status==='ready'&&playing(j))
  &&(j.effect.type==='live.direction'||j.effect.type==='scene.request'||j.effect.type==='image.request'&&j.effect.presentation!=='background'));
 const records:Array<{plan?:GenesisQueuePlanItem&{queuedAt:number};job?:GenesisJob}> = active.map(job=>({job,plan:plans.find(p=>(p.jobId||p.id)===job.id)}));
 for(const plan of plans){const job=state.jobs.find(j=>(plan.jobId||plan.id)===j.id);if(!records.some(r=>r.plan?.id===plan.id)&&(!job||active.includes(job)))records.push({plan,job});}
 const first=active[0],candidate=timing.firstStartsAt===undefined&&first?.effect.type==='live.direction'?(first.startedAt||first.queuedAt||0)+2*duration:timing.firstStartsAt;
 let next=candidate&&candidate>now?candidate:null;
 let items:GenesisQueueView['items']=records.map(({plan,job},index)=>{
  const isPlaying=job?playing(job):plan?.status==='playing';
  const waitingForFrame=!!job&&genesisRequiredFrameStatus(state,job,now)==='waiting';
  const status=isPlaying?'playing' as const:waitingForFrame||job?.status==='running'||plan?.status==='preparing'?'preparing' as const:'queued' as const;
  const span=job?.playbackDurationMs||plan?.durationMs||(job?.effect.duration?job.effect.duration*1000:duration);
  const supplied=job?.estimatedPlaybackAt;
  const scheduled=supplied!==undefined?(supplied>now?(index===0?supplied:Math.max(supplied,next??supplied)):null):next;
  const start=isPlaying?(job?.id===timing.playingJobId?timing.playingStartedAt:job?.playbackStartedAt)||now:waitingForFrame?null:scheduled;
  const predictedEnd=start===null?null:start+span;
  const end=predictedEnd!==null&&predictedEnd>now?predictedEnd:null;
  next=end===null?null:end+(timing.gapMs??duration);
  const target=job?.targetPlaybackAt??null;
  const targetStatus=isPlaying?'playing' as const:target===null?'unknown' as const:now>target?'missed' as const:start===null?'unknown' as const:start<=target?'on-track' as const:'at-risk' as const;
  return {priority:job?.effect.delivery?.priority||'queued',targetStartAt:target,targetLatencyMs:job?.effect.delivery?.targetLatencyMs??null,targetStatus,mergedEffectIds:job?.mergedEffects?.map(e=>e.id)||[],mergedActions:job?.mergedEffects?.map(e=>({id:e.id,label:e.label||'World action',prompt:e.displayPrompt??null,actionId:e.sourceActionId||null}))||[],id:plan?.id||job!.id,jobId:job?.id||plan?.jobId||null,actionId:plan?.actionId||job?.sourceActionId||null,kind:job?.effect.type||'action',
   label:job?.mergedEffects?job.effect.label||'Combined actions':plan?.label||job?.effect.label||'World action',prompt:job?.mergedEffects?job.effect.displayPrompt??null:plan?.prompt??job?.effect.displayPrompt??null,position:index+1,status,
   source:'action',chunkSequence:null,waitingForFrame,queuedAt:plan?.queuedAt??job?.queuedAt??null,durationMs:span,estimatedStartAt:start,estimatedEndAt:end,estimatedWaitMs:isPlaying?0:start===null?null:Math.max(0,start-now)};
 });
 const chunks=timing.chunks||[],seen=new Set<string>();
 if(chunks.length>12)throw Error('Provide at most 12 observed stream chunks.');
 for(const chunk of chunks){
  if(!safe(chunk.id)||seen.has(chunk.id)||typeof chunk.label!=='string'||!chunk.label.trim()||chunk.label.length>100||chunk.prompt!==undefined&&(typeof chunk.prompt!=='string'||chunk.prompt.length>2000)||!Number.isInteger(chunk.sequence)||chunk.sequence<0||!['queued','preparing','playing'].includes(chunk.status)||!Number.isFinite(chunk.durationMs)||chunk.durationMs<1000||chunk.durationMs>120000||chunk.estimatedStartAt!==null&&(!Number.isFinite(chunk.estimatedStartAt)||chunk.estimatedStartAt<=0))throw Error('Provide valid host stream chunk timing and public labels.');
  seen.add(chunk.id);
  if(chunk.jobId&&state.jobs.some(j=>j.id===chunk.jobId&&j.status==='cancelled'))continue;
  const linked=chunk.jobId?items.find(i=>i.jobId===chunk.jobId):undefined;
  if(linked)items=items.filter(i=>i!==linked);
  const start=chunk.estimatedStartAt!==null&&(chunk.status==='playing'||chunk.estimatedStartAt>now)?chunk.estimatedStartAt:null;
  const end=start!==null&&start+chunk.durationMs>now?start+chunk.durationMs:null;
  items.push({priority:linked?.priority||'queued',targetStartAt:linked?.targetStartAt??null,targetLatencyMs:linked?.targetLatencyMs??null,targetStatus:chunk.status==='playing'?'playing':linked?.targetStatus||'unknown',mergedEffectIds:linked?.mergedEffectIds||[],mergedActions:linked?.mergedActions||[],id:linked?.id||chunk.id,jobId:linked?.jobId||null,actionId:linked?.actionId||null,kind:linked?.kind||'stream.chunk',label:linked?.label||chunk.label,prompt:linked?.prompt??chunk.prompt??null,position:0,source:linked?'action':chunk.source||'genesis',chunkSequence:chunk.sequence,status:chunk.status,queuedAt:linked?.queuedAt||null,durationMs:chunk.durationMs,estimatedStartAt:start,estimatedEndAt:end,estimatedWaitMs:chunk.status==='playing'?0:start===null?null:start-now});
 }
 if(chunks.length){items.sort((a,b)=>(a.status==='playing'?-1:0)-(b.status==='playing'?-1:0)||(a.estimatedStartAt??Infinity)-(b.estimatedStartAt??Infinity)||(a.chunkSequence??Infinity)-(b.chunkSequence??Infinity));items.forEach((item,i)=>item.position=i+1);}
 const cancelledItems=state.jobs.filter(j=>j.status==='cancelled'&&j.supersededBy&&j.cancelledAt&&now-j.cancelledAt<12000&&!j.effect.frame).slice(-6).map(j=>({id:j.id,jobId:j.id,label:j.effect.label||'World action',prompt:j.effect.displayPrompt??null,status:'cancelled' as const,supersededBy:j.supersededBy!,cancelledAt:j.cancelledAt!}));
 return {version:1,revision:state.revision,serverNow:now,estimated:true,items,cancelledItems};
}
