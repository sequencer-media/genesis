import type {ExperienceDefinition} from './experienceDefinition.js';
import type {GenesisEffect, GenesisJob, GenesisState} from './genesisCore.js';
import type {GenesisHostPolicy} from './policy.js';

export interface GenesisFrameSpec {
  key: string;
  /** Includes every material scene dependency, such as cast, pose, setting and style. */
  fingerprint: string;
  ttlMs?: number;
  priority?: number;
  refresh?: boolean;
}
export interface GenesisPreparedFrame {
  key: string; fingerprint: string;
  status: 'pending' | 'preparing' | 'ready' | 'failed' | 'stale';
  generation: number; attempts: number; requestedAtMs: number; lastUsedAtMs: number;
  readyAtMs: number; expiresAtMs: number; jobId: string; anchorId: string; error: string;
  request: GenesisEffect;
  /** Imported saved assets expire without scheduling paid regeneration. */
  imported?: boolean;
}
const keyPattern = /^[A-Za-z0-9_.:-]{1,64}$/;
const safeKey = (x: unknown): x is string => typeof x === 'string' && keyPattern.test(x) && !['__proto__','prototype','constructor'].includes(x);
const fingerprint = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 512;
const active = (j: GenesisJob) => ['queued','running'].includes(j.status);
const matchesGuard = (state: GenesisState, e: GenesisEffect) => !e.guard || state.server[e.guard.key] === e.guard.value;

/** Preparation is a bounded wishlist. Only one image job is admitted at a time. */
export function prepareGenesisFrame(def: ExperienceDefinition, state: GenesisState, effect: GenesisEffect, now: number, policy: GenesisHostPolicy) {
  const spec = effect.frame;
  if (!spec || !safeKey(spec.key) || !fingerprint(spec.fingerprint)
    || spec.ttlMs !== undefined && (!Number.isInteger(spec.ttlMs) || spec.ttlMs < 30_000 || spec.ttlMs > 86_400_000)
    || spec.priority !== undefined && (!Number.isInteger(spec.priority) || spec.priority < 0 || spec.priority > 100)
    || spec.refresh !== undefined && typeof spec.refresh !== 'boolean') throw new Error('Use a valid frame key, fingerprint, priority and lifetime.');
  if (!policy.capabilities.includes('image.request') || !def.genesis?.capabilities.includes('image.request')) throw new Error('Frame preparation requires the image.request grant.');
  if (!effect.intent || typeof effect.intent !== 'string' || effect.intent.length > 4000) throw new Error('Give the frame a scene-only intent under 4,000 characters.');
  if (effect.anchorId && !Object.hasOwn(state.anchors, effect.anchorId)
    || effect.referenceAnchorIds && (!Array.isArray(effect.referenceAnchorIds) || effect.referenceAnchorIds.length > 4 || effect.referenceAnchorIds.some(id => !Object.hasOwn(state.anchors, id)))) throw new Error('Use accepted frame references.');
  const ceiling = Math.min(policy.maxActionCostUsd, def.genesis.limits.maxActionCostUsd, 5);
  const cost = effect.maxCostUsd ?? Math.min(.05, ceiling);
  if (!Number.isFinite(cost) || cost < .01 || cost > ceiling) throw new Error('The prepared frame exceeds the image spending limit.');
  const library = state.frameLibrary ||= {};
  const previous = library[spec.key];
  if (previous?.fingerprint === spec.fingerprint && !spec.refresh
    && (['pending','preparing'].includes(previous.status) || previous.status === 'ready' && previous.expiresAtMs > now
      || previous.status === 'failed' && (previous.attempts >= 2 || now < previous.requestedAtMs + 60_000))) {
    previous.request.frame!.priority = Math.max(previous.request.frame!.priority || 0, spec.priority || 0);
    return;
  }
  if (!previous && Object.keys(library).length >= 16) {
    const removable = Object.values(library).filter(f => f.status !== 'preparing' && f.anchorId !== state.stage.anchorId
      && !state.jobs.some(j=>active(j)&&j.effect.frameRef?.required&&j.effect.frameRef.key===f.key&&j.effect.frameRef.fingerprint===f.fingerprint))
      .sort((a,b) => Number(a.request.frame?.refresh!==true)-Number(b.request.frame?.refresh!==true)
        || Math.max(a.lastUsedAtMs,a.requestedAtMs)-Math.max(b.lastUsedAtMs,b.requestedAtMs))[0];
    if (!removable) return;
    delete library[removable.key];
  }
  const request: GenesisEffect = {...effect, type:'image.request', presentation:'background', maxCostUsd:cost, delivery:{priority:'queued',replaceable:true},
    frame:{...spec, ttlMs:spec.ttlMs ?? 600_000, priority:spec.priority ?? 50}};
  // A revised batch invalidates its old image before the joint frame is admitted.
  if(previous&&previous.fingerprint!==spec.fingerprint){
    const old=state.jobs.find(j=>j.id===previous.jobId&&active(j));
    if(old){old.status='cancelled';old.cancelledAt=now;old.supersededBy=effect.id;
      if(old.startedAt)old.providerCancellation='pending';
      else if(!old.reservationReleased){state.reservedCostUsd=Math.max(0,Math.round((state.reservedCostUsd-old.maxCostUsd)*10000)/10000);old.reservationReleased=true;}}
  }
  library[spec.key] = {key:spec.key, fingerprint:spec.fingerprint, status:'pending', generation:(previous?.generation || 0)+1,
    attempts:previous?.fingerprint === spec.fingerprint && previous.status === 'failed' ? previous.attempts : 0,
    requestedAtMs:now, lastUsedAtMs:previous?.lastUsedAtMs || 0, readyAtMs:0, expiresAtMs:0, jobId:'', anchorId:'', error:'', request};
  if (JSON.stringify(library).length > 64_000) throw new Error('Keep the prepared frame library below 64 KB.');
}

export function invalidateGenesisFrame(state: GenesisState, key: string | undefined) {
  if (!safeKey(key)) throw new Error('Choose a valid frame library key.');
  const frame = state.frameLibrary?.[key];
  if (frame) { frame.status='stale'; frame.generation++; frame.anchorId=''; }
}

/** Retire provider authority and leave a valid wishlist request available for a later safe slot. */
export function deferGenesisFrame(state:GenesisState,job:GenesisJob){
  const entry=job.effect.frame&&state.frameLibrary?.[job.effect.frame.key];
  if(!entry||entry.jobId!==job.id||entry.status!=='preparing')return;
  entry.status=matchesGuard(state,job.effect)?'pending':'stale';entry.generation++;entry.jobId='';entry.anchorId='';
}

/** Readiness never changes the displayed stage or applies a speculative game outcome. */
export function settleGenesisFrame(state: GenesisState, job: GenesisJob, anchorId: string, error: string, now: number, expiresAtMs?: number): boolean {
  if (!job.effect.frame) return true;
  const entry = state.frameLibrary?.[job.effect.frame.key];
  if (!entry || entry.jobId !== job.id || entry.generation !== job.effect.frameGeneration
    || entry.fingerprint !== job.effect.frame.fingerprint) return false;
  if(!matchesGuard(state,job.effect)){deferGenesisFrame(state,job);return false;}
  entry.status=error ? 'failed' : 'ready'; entry.error=error.slice(0,240); entry.anchorId=error ? '' : anchorId;
  entry.readyAtMs=error ? 0 : now; entry.expiresAtMs=error ? 0 : Math.min(expiresAtMs ?? Infinity,now+(entry.request.frame!.ttlMs || 600_000));
  if(error&&entry.attempts<2&&state.jobs.some(j=>active(j)&&j.effect.frameRef?.required&&j.effect.frameRef.key===entry.key&&j.effect.frameRef.fingerprint===entry.fingerprint)){
    entry.status='pending';entry.generation++;entry.jobId='';
  }
  return true;
}

/** Required references retain their dependency until dispatch; optional references can continue. */
export function resolveGenesisFrame(state: GenesisState, effect: GenesisEffect, now: number): GenesisEffect {
  const ref=effect.frameRef;
  if (!ref) return effect;
  if (!['scene.request','live.direction'].includes(effect.type) || !safeKey(ref.key) || !fingerprint(ref.fingerprint)
    || ref.required !== undefined && typeof ref.required !== 'boolean'
    || effect.useStartFrame === false) throw new Error('Reference a prepared frame from a linked scene or live direction.');
  const entry=state.frameLibrary?.[ref.key];
  if (entry?.fingerprint === ref.fingerprint && matchesGuard(state,entry.request)) {
    if (entry.status === 'ready' && entry.expiresAtMs > now && state.anchors[entry.anchorId]) {
      entry.lastUsedAtMs=now;
      return {...effect,anchorId:entry.anchorId,continuity:'reanchor'};
    }
    if(entry.imported){
      if(ref.required)throw new Error('The required saved frame expired. Cache a current image before requesting this action.');
      const {frameRef:unusedRef,anchorId:unusedAnchor,...continuation}=effect;
      return {...continuation,...(effect.frameMode?{frameMode:'continue' as const}:{}),continuity:'linked'};
    }
    if (entry.status === 'ready' || entry.status === 'stale') {entry.status='pending';entry.generation++;entry.anchorId='';}
    entry.request.frame!.priority=100;
  }
  if(ref.required){
    if(!entry||entry.fingerprint!==ref.fingerprint)throw new Error('Prepare the exact required frame before requesting its action.');
    const {anchorId:unused,...waiting}=effect;
    return {...waiting,frameMode:'new-frame',continuity:'reanchor'};
  }
  const {frameRef:unusedRef,anchorId:unusedAnchor,...continuation}=effect;
  return {...continuation,...(effect.frameMode?{frameMode:'continue' as const}:{}),continuity:'linked'};
}

export function scheduleGenesisFrame(def: ExperienceDefinition, state: GenesisState, now: number, policy: GenesisHostPolicy): GenesisEffect | undefined {
  const library=state.frameLibrary || {};
  for (const entry of Object.values(library)) {
    if (!matchesGuard(state,entry.request)) {entry.status='stale';continue;}
    if (entry.status === 'ready' && entry.expiresAtMs <= now) {
      entry.status=entry.imported?'stale':'pending';entry.generation++;entry.attempts=0;entry.anchorId='';
    }
  }
  const jobs=state.jobs.filter(active);
  const required=jobs.filter(j=>j.effect.frameRef?.required).map(j=>j.effect.frameRef!);
  const needed=(f:GenesisPreparedFrame)=>required.some(r=>r.key===f.key&&r.fingerprint===f.fingerprint);
  if (jobs.some(j => j.effect.type !== 'live.direction' && !(j.effect.type==='scene.request'&&j.status==='queued'&&j.effect.frameRef?.required))) return;
  const urgent=jobs.some(j=>j.effect.delivery?.priority==='urgent');
  const remaining=Math.min(policy.maxSessionCostUsd,def.genesis!.limits.maxSessionCostUsd)-state.reservedCostUsd;
  const next=Object.values(library).filter(f => f.status === 'pending' && matchesGuard(state,f.request)
    && (!urgent||needed(f)) && (f.request.maxCostUsd || .05) <= remaining+1e-8)
    .sort((a,b) => Number(needed(b))-Number(needed(a)) || (b.request.frame!.priority || 0)-(a.request.frame!.priority || 0) || a.requestedAtMs-b.requestedAtMs)[0];
  if (!next) return;
  next.status='preparing';next.attempts++;state.frameSequence=(state.frameSequence || 0)+1;
  next.jobId=`frame:${next.key}:${state.frameSequence}`;
  return {...next.request,id:next.jobId,frameGeneration:next.generation};
}

/** Required action frames are a dispatch barrier, never a silent continuation fallback. */
export function genesisRequiredFrameStatus(state:GenesisState,job:GenesisJob,now=Date.now()):'ready'|'waiting'|'failed'{
  const ref=job.effect.frameRef;if(!ref?.required)return 'ready';
  const entry=state.frameLibrary?.[ref.key];
  if(!entry||entry.fingerprint!==ref.fingerprint||!matchesGuard(state,entry.request)||entry.status==='failed'||entry.imported&&entry.expiresAtMs<=now)return 'failed';
  return entry.status==='ready'&&entry.expiresAtMs>now&&!!state.anchors[entry.anchorId]?.imageUrl?'ready':'waiting';
}

export function genesisFrameLibraryView(state: GenesisState) {
  return Object.fromEntries(Object.entries(state.frameLibrary || {}).map(([key,f]) => [key,{
    key, fingerprint:f.fingerprint,status:f.status,anchorId:f.anchorId,readyAtMs:f.readyAtMs,expiresAtMs:f.expiresAtMs,
    attempts:f.attempts,error:f.error,priority:f.request.frame?.priority || 0,
  }]));
}

export function nextGenesisFrameRefreshAt(state: GenesisState): number | undefined {
  const times=Object.values(state.frameLibrary || {}).filter(f => f.status === 'ready' && matchesGuard(state,f.request)).map(f => f.expiresAtMs);
  return times.length ? Math.min(...times) : undefined;
}
