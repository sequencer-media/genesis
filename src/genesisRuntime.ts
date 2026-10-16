import { defaultGenesisHostPolicy, type GenesisHostPolicy } from './policy.js';
import type { ExperienceDefinition } from './experienceDefinition.js';
import type { ExperienceSessionState } from './experienceSessionCore.js';
import { applyGenesisTransition, GenesisRequestError, defaultGenesisController, genesisActions, genesisContext, genesisView, validateGenesisAction, type GenesisEvent, type GenesisState } from './genesisCore.js';
import { runGenesisController } from './genesisController.js';
import { applyGenesisPlayerRequest, genesisParticipantRole, tickGenesisParticipation, releaseGenesisSeat, type GenesisPlayerRequest, type GenesisSeatEvent } from './participation.js';
import {nextGenesisFrameRefreshAt, settleGenesisFrame} from './frameLibrary.js';

export async function dispatchGenesisEvent(def: ExperienceDefinition, previous: ExperienceSessionState, source: string, event: GenesisEvent, policy: GenesisHostPolicy = defaultGenesisHostPolicy, depth = 0): Promise<ExperienceSessionState> {
  if (depth > 8) throw new GenesisRequestError('The controller created too many participation transitions.');
  const genesis = previous.genesis!;
  if (genesis.receipts.includes(event.id)) return previous;
  const context = genesisContext(def, genesis, event, previous.participants);
  if (previous.participation) context.participation = { version: 1, seats: previous.participation.seats.map(s => ({ id: s.id, label: def.participation.seats!.slots.find(slot => slot.id === s.id)!.label, actorId: s.actorId })), queueLength: previous.participation.queue.length };
  const transition = def.genesis!.controller === 'custom' ? await runGenesisController(source, context) : defaultGenesisController(context);
  let next = { ...previous, revision: previous.revision + 1, genesis: applyGenesisTransition(def, genesis, event, transition, policy) };
  const seatEvents: GenesisSeatEvent[] = [];
  for (const effect of transition.effects || []) if (effect.type === 'players.release' && !genesis.effectIds.includes(effect.id)) {
    const result = releaseGenesisSeat(def, next, effect.seatId!, effect.expectedActorId!, effect.cooldownMs || 0, event.now);
    next = result.state as typeof next; seatEvents.push(...result.events);
  }
  const created = next.genesis.jobs.filter(job => !genesis.jobs.some(old => old.id === job.id));
  if (created.length) {
    const context = Object.entries(previous.persistentInputs).flatMap(([actor, inputs]) => Object.entries(inputs).filter(([id]) => def.inputs.find(input => input.id === id)?.scope !== 'conversation').map(([, input]) => `${actor}: ${input.text}`)).join('\n').slice(0, 2400);
    for (const job of created) job.inputContext = context;
  }
  const boundary = created.length || next.genesis.window?.id !== genesis.window?.id;
  if (boundary) {
    next.persistentInputs = JSON.parse(JSON.stringify(previous.persistentInputs));
    for (const inputs of Object.values(next.persistentInputs)) for (const [id, input] of Object.entries(inputs)) if (input.lifetime === 'one_action' || input.lifetime === 'phase') delete inputs[id];
  }
  return dispatchGenesisSeatEvents(def, next, source, seatEvents, event.now, policy, depth + 1);
}
async function dispatchGenesisSeatEvents(def: ExperienceDefinition, state: ExperienceSessionState, source: string, events: GenesisSeatEvent[], now: number, policy: GenesisHostPolicy, depth = 0) {
  for (let i = 0; i < events.length; i++) state = await dispatchGenesisEvent(def, state, source, { ...events[i], id: `participation:${state.revision}:${i}:${events[i].type}`, now }, policy, depth);
  return state;
}
export async function requestGenesisPlayer(def: ExperienceDefinition, previous: ExperienceSessionState, source: string, actorId: string, request: GenesisPlayerRequest, now = Date.now(), policy: GenesisHostPolicy = defaultGenesisHostPolicy) {
  const current = await tickGenesis(def, previous, source, now, policy);
  const result = applyGenesisPlayerRequest(def, current, actorId, request, now);
  return dispatchGenesisSeatEvents(def, result.state, source, result.events, now, policy);
}
export function withGenesisView(def: ExperienceDefinition, state: ExperienceSessionState, actorId: string, policy: GenesisHostPolicy = defaultGenesisHostPolicy) {
  if (!def.genesis || !state.genesis) return {};
  const role = genesisParticipantRole(state, state.participants.find(p => p.id === actorId));
  const view = genesisView(def, state.genesis, actorId, role, policy);
  if (state.status !== 'active') view.actions = view.actions.map(action => ({ ...action, canSubmit: false }));
  return { genesis: view };
}
export async function submitGenesisAction(def: ExperienceDefinition, state: ExperienceSessionState, source: string, actorId: string, eventId: string, actionId: string, payload: unknown, expectedRevision: number, now = Date.now(), policy: GenesisHostPolicy = defaultGenesisHostPolicy) {
  const revisionBeforeTick = state.genesis!.revision;
  const windowBeforeTick = JSON.stringify(state.genesis!.window);
  state = await tickGenesis(def, state, source, now, policy);
  const genesis = state.genesis!, actor = state.participants.find(p => p.id === actorId), role = genesisParticipantRole(state, actor, now);
  if (!actor || state.status !== 'active') throw new GenesisRequestError('Join the active experience first.');
  // A due background timer may advance the revision inside this request. A
  // fresh click remains valid when its exact decision window is unchanged.
  const actionRevision = expectedRevision === revisionBeforeTick && windowBeforeTick === JSON.stringify(genesis.window)
    ? genesis.revision : expectedRevision;
  const data = validateGenesisAction(def, genesis, actorId, role, actionId, payload, actionRevision, now, policy);
  const action = genesisActions(def).find(a => a.id === actionId)!;
  if (genesis.window?.mode === 'collective') {
    if (payload && (payload as any).windowId !== genesis.window.id) throw new GenesisRequestError('This voting window changed. Choose from the current options.');
    const next = JSON.parse(JSON.stringify(state)) as ExperienceSessionState;
    next.genesis!.ballots[actorId] = String(data.optionId); next.genesis!.revision++; next.revision++;
    return dispatchGenesisEvent(def, next, source, { id: eventId, type: 'vote.cast', actorId, actionId: action.id, data, now }, policy);
  }
  const binding = def.inputs.find(input => input.id === action.inputBindingId)!;
  let accepted = state;
  if (['text', 'voice', 'image'].includes(binding.kind) && binding.scope !== 'conversation') {
    accepted = JSON.parse(JSON.stringify(state));
    const key = binding.scope === 'world' ? '_world' : actorId;
    accepted.persistentInputs[key] ||= {};
    accepted.persistentInputs[key][binding.id] = { text: typeof data.text === 'string' ? data.text : '', imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '', lifetime: binding.lifetime, phaseId: state.genesis!.window?.id || '' };
  }
  return dispatchGenesisEvent(def, accepted, source, { id: eventId, type: 'action', actorId, actionId: action.id, data, now }, policy);
}
export async function tickGenesis(def: ExperienceDefinition, previous: ExperienceSessionState, source: string, now = Date.now(), policy: GenesisHostPolicy = defaultGenesisHostPolicy) {
  let state = previous;
  const participation = tickGenesisParticipation(def, state, now);
  state = await dispatchGenesisSeatEvents(def, participation.state, source, participation.events, now, policy);
  const window = state.genesis?.window;
  if (window?.mode === 'collective' && !window.closed && window.deadline && now >= window.deadline) {
    const counts = window.options!.map(option => ({ ...option, count: Object.values(state.genesis!.ballots).filter(id => id === option.id).length }));
    const winner = [...counts].sort((a, b) => b.count - a.count)[0];
    const closed = { ...state, genesis: { ...state.genesis!, window: { ...window, closed: true } } };
    state = await dispatchGenesisEvent(def, closed, source, { id: `vote:${window.id}`, type: winner.count ? 'vote.resolved' : 'vote.empty', actionId: window.actionIds[0], data: { windowId: window.id, ...winner, counts }, now }, policy);
    if (!winner.count && def.genesis!.controller === 'default') state = await dispatchGenesisEvent(def, state, source, { id: `reopen:${window.id}`, type: 'participant.joined', data: {}, now }, policy);
  }
  for (const timer of state.genesis!.timers.filter(t => t.dueAt <= now)) {
    state = { ...state, genesis: { ...state.genesis!, timers: state.genesis!.timers.filter(t => t.id !== timer.id) } };
    state = await dispatchGenesisEvent(def, state, source, { id: `timer:${timer.id}`, type: 'timer', data: { timerId: timer.id, ...timer.data }, now }, policy);
  }
  const refreshAt=nextGenesisFrameRefreshAt(state.genesis!);
  if (refreshAt !== undefined && refreshAt <= now) state={...state,revision:state.revision+1,
    genesis:applyGenesisTransition(def,state.genesis!,{id:`frame-refresh:${state.genesis!.revision}:${now}`,type:'frame.refresh',data:{},now},{},policy)};
  return state;
}
export async function settleGenesisJob(def: ExperienceDefinition, previous: ExperienceSessionState, source: string, jobId: string, result: { imageUrl?: string; videoUrl?: string; error?: string; mediaId?: string; reused?: boolean; frameExpiresAtMs?: number; data?: Record<string, unknown> }, now = Date.now(), policy: GenesisHostPolicy = defaultGenesisHostPolicy) {
  const job = previous.genesis!.jobs.find(j => j.id === jobId);
  if (!job || !['queued', 'running'].includes(job.status)) return previous;
  let state = JSON.parse(JSON.stringify(previous)) as ExperienceSessionState;
  const current = state.genesis!.jobs.find(j => j.id === jobId)!;
  if(job.effect.frame&&!result.error&&(!result.imageUrl||!policy.validateAssetUrl(result.imageUrl)))result={error:'The frame provider must return a saved scene image.'};
  const anchorId = result.imageUrl ? `anchor:${jobId}` : '';
  const acceptedFrame=settleGenesisFrame(state.genesis!,job,anchorId,result.error || '',now,result.frameExpiresAtMs);
  if (!acceptedFrame || job.effect.guard && state.genesis!.server[job.effect.guard.key] !== job.effect.guard.value) {
    current.status = 'cancelled'; state.genesis!.revision++; state.revision++;
    if (state.genesis!.stage.ownerJobId === jobId) { state.genesis!.stage.ownerJobId = ''; state.genesis!.stage.mode = 'holding'; }
    return dispatchGenesisEvent(def, state, source, { id: `cancel:${jobId}:${job.retryCount}`, type: 'job.cancelled', data: { jobId }, now }, policy);
  }
  current.status = result.error ? 'failed' : 'ready'; current.error = result.error || '';
  if (job.effect.frame && result.reused) state.genesis!.reservedCostUsd=Math.max(0,state.genesis!.reservedCostUsd-job.maxCostUsd);
  if (anchorId) state.genesis!.anchors[anchorId] = { id: anchorId, imageUrl: result.imageUrl!, revision: state.genesis!.revision + 1, sourceMediaId: result.mediaId || '', ...(result.videoUrl ? { time: 'end' as const } : {}) };
  current.result = { imageUrl: result.imageUrl || '', videoUrl: result.videoUrl || '', anchorId, ...(result.data ? { data: result.data } : {}) };
  // Explicit restore/show during a running job cancels its authority over the stage.
  if (!['tool.request', 'live.direction'].includes(job.effect.type) && job.effect.presentation !== 'background' && state.genesis!.stage.ownerJobId !== jobId) { current.status = 'cancelled'; state.genesis!.revision++; state.revision++; return state; }
  if (job.effect.type !== 'tool.request' && job.effect.presentation !== 'background') { state.genesis!.stage.mode = 'holding'; state.genesis!.stage.ownerJobId = ''; }
  if (job.effect.type !== 'tool.request' && anchorId && result.videoUrl) state.genesis!.stage.anchorId = anchorId;
  return dispatchGenesisEvent(def, state, source, { id: `job:${jobId}:${job.retryCount}`, type: result.error ? 'job.failed' : 'job.ready', data: { jobId, ...current.result, error: current.error, ...(job.effect.frame ? {frameKey:job.effect.frame.key,frameFingerprint:job.effect.frame.fingerprint} : {}) }, now }, policy);
}
export async function completeGenesisPlayback(def: ExperienceDefinition, previous: ExperienceSessionState, source: string, actorId: string, playbackId: string, now = Date.now(), policy: GenesisHostPolicy = defaultGenesisHostPolicy) {
  previous = await tickGenesis(def, previous, source, now, policy);
  const stage = previous.genesis!.stage;
  if (genesisParticipantRole(previous, previous.participants.find(p => p.id === actorId), now) !== 'player') throw new GenesisRequestError('Only players can complete shared playback.');
  if (stage.playbackId !== playbackId) throw new GenesisRequestError('This playback changed.');
  if (stage.playedBy.includes(actorId) || stage.mode !== 'playing') return previous;
  const state = JSON.parse(JSON.stringify(previous)) as ExperienceSessionState;
  state.genesis!.stage.playedBy.push(actorId); state.genesis!.revision++; state.revision++;
  if (def.genesis!.playbackCompletion === 'all_players' && state.participants.filter(p => p.role === 'player').some(p => !state.genesis!.stage.playedBy.includes(p.id))) return state;
  state.genesis!.stage.mode = 'holding';
  return dispatchGenesisEvent(def, state, source, { id: `playback:${playbackId}`, type: 'playback.completed', actorId, data: { playbackId, anchorId: stage.anchorId }, now }, policy);
}
export function retryGenesisJob(previous: ExperienceSessionState, jobId: string): ExperienceSessionState {
  const state = JSON.parse(JSON.stringify(previous)) as ExperienceSessionState, job = state.genesis!.jobs.find(j => j.id === jobId);
  if (!job || job.status !== 'failed') throw new GenesisRequestError('Choose a failed job.');
  if (job.retryCount >= 2) throw new GenesisRequestError('This job has reached its retry limit.');
  job.status = 'queued'; job.error = ''; job.retryCount++; if (!['tool.request', 'live.direction'].includes(job.effect.type) && job.effect.presentation !== 'background') { state.genesis!.stage.mode = 'generating'; state.genesis!.stage.ownerJobId = jobId; state.genesis!.stage.overlays = false; } state.genesis!.revision++; state.revision++;
  return state;
}
