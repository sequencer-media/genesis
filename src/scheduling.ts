import {deferGenesisFrame} from './frameLibrary.js';
import type {GenesisEffect, GenesisJob, GenesisState} from './genesisCore.js';

/** Delivery is chosen by controller policy before prompt generation. Targets are advisory. */
export interface GenesisDelivery {
  priority: 'urgent' | 'queued' | 'mergeable';
  mergeKey?: string;
  replaceable?: boolean;
  targetLatencyMs?: number;
  /** Server-recorded user selection time, before a shared lock-in barrier if applicable. */
  selectedAtMs?: number;
}
export interface GenesisMergedEffect {
  id:string; intent:string; requiredOutcome?:unknown; label?:string; displayPrompt?:string;
  sourceEventId:string; sourceActionId?:string; queuedAt:number;
}
const safe=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);

export function normalizeGenesisScheduling(input:GenesisEffect,now?:number):GenesisEffect {
  const effect=structuredClone(input), d=effect.delivery;
  if(d!==undefined){
    if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!['priority','mergeKey','replaceable','targetLatencyMs','selectedAtMs'].includes(k))
      ||!['urgent','queued','mergeable'].includes(d.priority)
      ||d.replaceable!==undefined&&typeof d.replaceable!=='boolean'
      ||d.targetLatencyMs!==undefined&&(!Number.isInteger(d.targetLatencyMs)||d.targetLatencyMs<1000||d.targetLatencyMs>120000)
      ||d.selectedAtMs!==undefined&&(!Number.isSafeInteger(d.selectedAtMs)||d.selectedAtMs<=0||now!==undefined&&d.selectedAtMs>now)
      ||d.mergeKey!==undefined&&!safe(d.mergeKey)
      ||d.priority==='mergeable'&&(!d.mergeKey||effect.type!=='live.direction')
      ||d.priority!=='mergeable'&&d.mergeKey!==undefined
      ||d.priority==='urgent'&&d.replaceable===true
      ||!['scene.request','live.direction','image.request','tool.request'].includes(effect.type))throw Error('Use valid delivery priority, replacement policy, merge key and latency target. Mergeable delivery is for live directions.');
    effect.delivery={...d,replaceable:d.replaceable??d.priority==='mergeable'};
  }
  if(effect.frameMode!==undefined){
    if(!['scene.request','live.direction'].includes(effect.type)||!['continue','new-frame','text-to-video'].includes(effect.frameMode))throw Error('Choose a supported scene frame mode.');
    if(effect.frameMode==='text-to-video'){
      if(effect.type!=='scene.request'||effect.anchorId||effect.frameRef||effect.referenceAnchorIds?.length||effect.continuity||effect.useStartFrame===true)throw Error('Text-to-video uses a standalone scene without frame references.');
      effect.useStartFrame=false;
    }else if(effect.frameMode==='new-frame'){
      if((!effect.anchorId&&!effect.frameRef)||effect.continuity==='linked'||effect.useStartFrame===false)throw Error('New-frame delivery requires an accepted anchor or an exact prepared frame reference.');
      effect.continuity='reanchor';
    }else{
      if(effect.frameRef||effect.continuity==='reanchor'||effect.useStartFrame===false)throw Error('Continue delivery uses the actual preceding frame.');
      effect.continuity='linked';
    }
  }
  return effect;
}

/** Returns true only for discardable presentation work that has never begun playback. */
export function isGenesisReplaceable(job:GenesisJob,state:GenesisState):boolean {
  return ['queued','running'].includes(job.status)&&job.effect.delivery?.replaceable===true
    &&job.effect.delivery.priority!=='urgent'&&!job.playbackStartedAt
    &&!(state.stage.mode==='playing'&&(state.stage.ownerJobId===job.id||!!job.result?.videoUrl&&state.stage.videoUrl===job.result.videoUrl));
}
export function releaseGenesisReservation(state:GenesisState,job:GenesisJob){
  if(job.reservationReleased)return;
  state.reservedCostUsd=Math.max(0,Math.round((state.reservedCostUsd-job.maxCostUsd)*10000)/10000);
  job.reservationReleased=true;
}
/** Cancellation changes presentation authority only. Canonical controller state is untouched. */
export function preemptGenesisJobs(state:GenesisState,effect:GenesisEffect,now:number):string[]{
  if(effect.delivery?.priority!=='urgent')return [];
  const ids:string[]=[];
  for(const job of state.jobs.filter(j=>isGenesisReplaceable(j,state))){
    const frame=job.effect.frame;
    if(frame&&[effect,...state.jobs.filter(j=>['queued','running'].includes(j.status)).map(j=>j.effect)]
      .some(e=>e.frameRef?.required&&e.frameRef.key===frame.key&&e.frameRef.fingerprint===frame.fingerprint))continue;
    const queued=job.status==='queued';job.status='cancelled';job.supersededBy=effect.id;
    if(queued&&!job.startedAt)releaseGenesisReservation(state,job);
    else job.providerCancellation='pending';
    deferGenesisFrame(state,job);
    if(state.stage.ownerJobId===job.id){state.stage.ownerJobId='';state.stage.mode='holding';state.stage.overlays=true;}
    ids.push(job.id);
  }
  if(ids.length&&state.queuePlan)state.queuePlan=state.queuePlan.filter(p=>!ids.includes(p.jobId||p.id));
  return ids;
}
const source=(job:GenesisJob):GenesisMergedEffect=>({id:job.id,intent:job.effect.intent||'',...(job.effect.requiredOutcome!==undefined?{requiredOutcome:job.effect.requiredOutcome}:{}),...(job.effect.label?{label:job.effect.label}:{}),...(job.effect.displayPrompt!==undefined?{displayPrompt:job.effect.displayPrompt}:{}),sourceEventId:job.sourceEventId,sourceActionId:job.sourceActionId,queuedAt:job.queuedAt||0});
const signature=(e:GenesisEffect)=>JSON.stringify([e.type,e.modelId||'',e.anchorId||'',e.frameRef||null,e.frameMode||'',e.continuity||'',e.useStartFrame??null,e.referenceAnchorIds||[],e.guard||null,e.duration||0,e.delivery?.replaceable]);
/** Combines only explicitly mergeable, compatible, unstarted directions, before any LLM call. */
export function mergeGenesisJob(state:GenesisState,incoming:GenesisJob):GenesisJob|undefined {
  if(incoming.effect.delivery?.priority!=='mergeable')return;
  const leader=state.jobs.find(j=>j.status==='queued'&&!j.startedAt&&j.effect.delivery?.priority==='mergeable'
    &&j.effect.delivery.mergeKey===incoming.effect.delivery!.mergeKey&&signature(j.effect)===signature(incoming.effect));
  if(!leader)return;
  const sources=[...(leader.mergedEffects||[source(leader)]),source(incoming)];
  const intent=sources.map((s,i)=>`${i+1}. ${s.intent}`).join('\n');
  const requiredOutcome={mergedOutcomes:sources.map(s=>({effectId:s.id,requiredOutcome:s.requiredOutcome??null}))};
  if(sources.length>8||intent.length>4000||JSON.stringify(sources).length>16000||JSON.stringify(requiredOutcome).length>3600)return;
  leader.mergedEffects=sources;leader.effect.intent=intent;
  const labels=sources.map(s=>s.label).filter(Boolean);if(labels.length)leader.effect.label=labels.join(' + ').slice(0,100);
  const prompts=sources.map(s=>s.displayPrompt).filter((p):p is string=>p!==undefined);if(prompts.length)leader.effect.displayPrompt=prompts.join('\n').slice(0,2000);
  leader.effect.requiredOutcome=requiredOutcome;
  const targets=[leader.targetPlaybackAt,incoming.targetPlaybackAt].filter((t):t is number=>typeof t==='number');
  if(targets.length)leader.targetPlaybackAt=Math.min(...targets);
  return leader;
}
/** Urgent FIFO wins the next free dispatch slot; running protected work keeps its slot. */
export function genesisDispatchOrder(state:GenesisState):GenesisJob[]{
  const active=state.jobs.filter(j=>['queued','running'].includes(j.status));
  return active.map((job,index)=>({job,index})).sort((a,b)=>Number(b.job.status==='running')-Number(a.job.status==='running')
    ||Number(b.job.effect.delivery?.priority==='urgent')-Number(a.job.effect.delivery?.priority==='urgent')||a.index-b.index).map(x=>x.job);
}
