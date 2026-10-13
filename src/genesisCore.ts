import { defaultGenesisHostPolicy, type GenesisHostPolicy } from './policy.js';
import type { ExperienceDefinition, GenesisAction } from './experienceDefinition.js';

export class GenesisRequestError extends Error {}

export interface GenesisAnchor { id: string; imageUrl: string; revision: number; sourceMediaId?: string; time?: 'end'; }
export interface GenesisWindow {
  id: string; actionIds: string[]; actorIds?: string[]; mode: 'individual' | 'collective';
  options?: Array<{ id: string; label: string }>; deadline?: number; closed?: boolean;
}
export interface GenesisEffect {
  id: string; type: 'scene.request' | 'image.request' | 'live.direction' | 'tool.request' | 'stage.restore' | 'stage.show' | 'stage.play' | 'timer.set' | 'players.release';
  seatId?: string; expectedActorId?: string; cooldownMs?: number;
  toolId?: `tool.${string}`; intent?: string; requiredOutcome?: unknown; anchorId?: string; imageUrl?: string; videoUrl?: string;
  modelId?: string; duration?: number; maxCostUsd?: number; delayMs?: number; data?: Record<string, unknown>;
  guard?: { key: string; value: string | number | boolean };
}
export interface GenesisEvent { id: string; type: string; actorId?: string; actionId?: string; data: Record<string, unknown>; now: number; }
export interface GenesisJob {
  id: string; effect: GenesisEffect; status: 'queued' | 'running' | 'ready' | 'failed' | 'cancelled';
  sourceRevision: number; sourceEventId: string; maxCostUsd: number; mediaId: string; error: string;
  result?: { imageUrl?: string; videoUrl?: string; anchorId?: string; data?: Record<string, unknown> }; retryCount: number;
  inputContext?: string; submissionUncertain?: boolean;
}
export interface GenesisState {
  revision: number; public: Record<string, unknown>; private: Record<string, Record<string, unknown>>; server: Record<string, unknown>;
  window: GenesisWindow | null; ballots: Record<string, string>; jobs: GenesisJob[]; anchors: Record<string, GenesisAnchor>;
  stage: { mode: 'holding' | 'generating' | 'playing'; anchorId: string; videoUrl: string; playbackId: string; playedBy: string[]; overlays: boolean; ownerJobId: string; visible?: boolean };
  timers: Array<{ id: string; dueAt: number; data: Record<string, unknown> }>;
  receipts: string[]; effectIds: string[]; reservedCostUsd: number;
}
export interface GenesisContext {
  state: Pick<GenesisState, 'public' | 'private' | 'server' | 'window'>;
  participation?: { version: 1; seats: Array<{ id: string; label: string; actorId: string }>; queueLength: number };
  event: GenesisEvent; ballots: Record<string, string>; participants: Array<{ id: string; name: string; role: string }>;
  jobs?: Array<{ id: string; status: GenesisJob['status']; type: GenesisEffect['type']; guard: GenesisEffect['guard'] | null }>;
  stage: GenesisState['stage']; anchors: GenesisState['anchors'];
  config: { worldPrompt: string; settings: Record<string, string | number | boolean>; inputs: ExperienceDefinition['inputs']; participation: ExperienceDefinition['participation']; video: ExperienceDefinition['worldVideo']; choices: string[]; roundSeconds: number; scenes: ExperienceDefinition['scenes'] };
}
export interface GenesisTransition {
  public?: Record<string, unknown>; private?: Record<string, Record<string, unknown>>; server?: Record<string, unknown>;
  window?: GenesisWindow | null; effects?: GenesisEffect[];
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const validId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(id) && !['__proto__', 'prototype', 'constructor'].includes(id);
export function genesisActions(def: ExperienceDefinition): GenesisAction[] {
  const custom = def.genesis?.actions || [];
  return [...custom, ...def.inputs.filter(i => !custom.some(a => a.inputBindingId === i.id)).map(i => ({ id: i.id, inputBindingId: i.id, label: i.kind === 'game' ? 'Action' : i.kind === 'click' ? 'Explore' : 'Send', fields: {} }))];
}
export function createGenesisState(def: ExperienceDefinition, imageUrl = ''): GenesisState {
  const anchor: GenesisAnchor = { id: 'start', imageUrl, revision: 0 };
  return { revision: 0, public: clone(def.genesis?.initialState || {}), private: {}, server: {}, window: null, ballots: {}, jobs: [], anchors: { start: anchor, ...Object.fromEntries(def.scenes.map(s => [s.id, { id: s.id, imageUrl: s.imageUrl, revision: 0 }])) },
    stage: { mode: 'holding', anchorId: 'start', videoUrl: '', playbackId: '', playedBy: [], overlays: true, ownerJobId: '', visible: def.worldVideo.enabled }, timers: [], receipts: [], effectIds: [], reservedCostUsd: 0 };
}
export function genesisContext(def: ExperienceDefinition, state: GenesisState, event: GenesisEvent, participants: GenesisContext['participants']): GenesisContext {
  return clone({ state: { public: state.public, private: state.private, server: state.server, window: state.window }, event, ballots: state.ballots, participants, stage: state.stage, anchors: state.anchors,
    jobs: state.jobs.map(j => ({ id: j.id, status: j.status, type: j.effect.type, guard: j.effect.guard || null })),
    config: { worldPrompt: def.genesis?.worldPrompt || '', settings: def.genesis?.config || {}, inputs: def.inputs, participation: def.participation, video: def.worldVideo, choices: def.rules.voteOptions, roundSeconds: def.rules.roundSeconds, scenes: def.scenes } });
}
export function canGenesisAct(def: ExperienceDefinition, state: GenesisState, actorId: string, role: string, actionId: string, now = Date.now()): boolean {
  const window = state.window, action = genesisActions(def).find(a => a.id === actionId);
  return !!action && !!window && !window.closed && window.actionIds.includes(actionId) && (!window.deadline || now < window.deadline)
    && (!window.actorIds || window.actorIds.includes(actorId)) && (role === 'player' || window.mode === 'collective')
    && (def.inputs.find(i => i.id === action.inputBindingId)?.kind !== 'click' || state.stage.mode === 'holding');
}
export function validateGenesisAction(def: ExperienceDefinition, state: GenesisState, actorId: string, role: string, actionId: string, payload: unknown, expectedRevision: number, now = Date.now(), policy: GenesisHostPolicy = defaultGenesisHostPolicy): Record<string, unknown> {
  if (!object(payload) || JSON.stringify(payload).length > 12000) throw new GenesisRequestError('Send an action payload under 12 KB.');
  if (!canGenesisAct(def, state, actorId, role, actionId, now)) throw new GenesisRequestError('This action is closed or belongs to another participant.');
  if (state.window?.mode !== 'collective' && expectedRevision !== state.revision) throw new GenesisRequestError('The scene changed. Refresh before acting.');
  const action = genesisActions(def).find(a => a.id === actionId)!, input = def.inputs.find(i => i.id === action.inputBindingId)!;
  for (const [key, field] of Object.entries(action.fields)) {
    const value = payload[key];
    if (value === undefined && !field.required) continue;
    if (typeof value !== field.type || field.type === 'number' && (!Number.isFinite(value) || field.min !== undefined && (value as number) < field.min || field.max !== undefined && (value as number) > field.max) || field.type === 'string' && (value as string).length > (field.maxLength || 1200)) throw new GenesisRequestError(`Use a valid ${key}.`);
  }
  if (Object.keys(action.fields).length && Object.keys(payload).some(key => key !== 'windowId' && !Object.hasOwn(action.fields, key))) throw new GenesisRequestError('Use declared action fields.');
  if (!Object.keys(action.fields).length) {
    if (['text', 'voice', 'game'].includes(input.kind) && (typeof payload.text !== 'string' || !payload.text.trim() || payload.text.length > input.maxLength)) throw new GenesisRequestError('Describe your action within the input limit.');
    if (input.kind === 'click') {
      if (payload.anchorId !== state.stage.anchorId || payload.sceneRevision !== state.anchors[state.stage.anchorId]?.revision) throw new GenesisRequestError('Click the current scene.');
      for (const key of ['x', 'y']) if (typeof payload[key] !== 'number' || !Number.isFinite(payload[key]) || (payload[key] as number) < 0 || (payload[key] as number) > 1) throw new GenesisRequestError('Click within the displayed frame.');
    }
  }
  if (input.kind === 'image' && (typeof payload.imageUrl !== 'string' || !policy.validateAssetUrl(payload.imageUrl) || typeof payload.text !== 'string' || payload.text.length > input.maxLength)) throw new GenesisRequestError('Use an uploaded image and description.');
  if (input.kind === 'click' && (payload.anchorId !== state.stage.anchorId || payload.sceneRevision !== state.anchors[state.stage.anchorId]?.revision)) throw new GenesisRequestError('Click the current scene.');
  if (state.window?.mode === 'collective' && !state.window.options?.some(option => option.id === payload.optionId)) throw new GenesisRequestError('Choose a current voting option.');
  return clone(payload);
}
/** Bound operational history while preserving current, authored and controller-referenced anchors. */
function compactGenesisHistory(def: ExperienceDefinition, state: GenesisState) {
  const pending = state.jobs.filter(job => ['queued', 'running', 'failed'].includes(job.status));
  const completed = state.jobs.filter(job => !['queued', 'running', 'failed'].includes(job.status)).slice(-8);
  state.jobs = [...pending, ...completed].sort((a, b) => a.sourceRevision - b.sourceRevision);
  const retained = new Set(['start', state.stage.anchorId, ...def.scenes.map(scene => scene.id)]);
  for (const job of state.jobs) { if (job.effect.anchorId) retained.add(job.effect.anchorId); if (job.result?.anchorId) retained.add(job.result.anchorId); }
  const creatorState = JSON.stringify([state.public, state.private, state.server]);
  for (const id of Object.keys(state.anchors)) if (!retained.has(id) && !creatorState.includes(JSON.stringify(id))) delete state.anchors[id];
}
export function applyGenesisTransition(def: ExperienceDefinition, previous: GenesisState, event: GenesisEvent, result: GenesisTransition, policy: GenesisHostPolicy = defaultGenesisHostPolicy): GenesisState {
  if (previous.receipts.includes(event.id)) return previous;
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new GenesisRequestError('Return a Genesis transition object.');
  const state = clone(previous); compactGenesisHistory(def, state); const nextRevision = state.revision + 1;
  for (const key of ['public', 'private', 'server'] as const) if (result[key] !== undefined) {
    if (!object(result[key])) throw new GenesisRequestError(`Return ${key} state as an object.`);
    (state as any)[key] = clone(result[key]);
  }
  for (const job of state.jobs) if (job.status === 'queued' && job.effect.guard && state.server[job.effect.guard.key] !== job.effect.guard.value) { job.status = 'cancelled'; state.reservedCostUsd = Math.max(0, state.reservedCostUsd - job.maxCostUsd); if (state.stage.ownerJobId === job.id) { state.stage.ownerJobId = ''; state.stage.mode = 'holding'; state.stage.overlays = true; } }
  if (result.window !== undefined) {
    const window = result.window;
    if (window !== null && (typeof window !== 'object' || Array.isArray(window) || !validId(window.id) || !['individual', 'collective'].includes(window.mode) || !Array.isArray(window.actionIds) || window.actionIds.length > 32 || window.actionIds.some(id => !genesisActions(def).some(a => a.id === id))
      || window.actorIds !== undefined && (!Array.isArray(window.actorIds) || window.actorIds.length > 100 || window.actorIds.some(id => !validId(id)))
      || window.deadline !== undefined && (!Number.isFinite(window.deadline) || window.deadline <= event.now || window.deadline > event.now + 120000)
      || window.mode === 'collective' && (!Array.isArray(window.options) || window.options.length < 2 || window.options.length > 12 || new Set(window.options.map(o => o.id)).size !== window.options.length || window.options.some(o => !validId(o.id) || typeof o.label !== 'string' || o.label.length > 160)))) throw new GenesisRequestError('Return a valid input window with declared actions, eligible participants and bounded choices.');
    if (state.window?.id !== window?.id) state.ballots = {};
    state.window = clone(window);
  }
  const effects = result.effects || [];
  if (!Array.isArray(effects) || effects.length > 8) throw new GenesisRequestError('Request up to eight effects per event.');
  for (const effect of effects) {
    if (effect.guard && (!validId(effect.guard.key) || !['string', 'number', 'boolean'].includes(typeof effect.guard.value) || typeof effect.guard.value === 'number' && !Number.isFinite(effect.guard.value) || typeof effect.guard.value === 'string' && effect.guard.value.length > 128)) throw new GenesisRequestError('Use a bounded server-state guard.');
    if (!validId(effect.id) || state.effectIds.includes(effect.id)) { if (state.effectIds.includes(effect.id)) continue; throw new GenesisRequestError('Use a valid effect ID.'); }
    if (['scene.request', 'image.request', 'live.direction', 'tool.request'].includes(effect.type)) {
      if (state.jobs.some(j => ['queued', 'running'].includes(j.status))) throw new GenesisRequestError('Wait for the active tool before requesting another scene tool.');
      const capability = effect.type === 'tool.request' ? effect.toolId : effect.type;
      if (effect.type === 'tool.request' && (!effect.toolId || !/^tool\.[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(effect.toolId) || !object(effect.data) || JSON.stringify(effect.data).length > 12000)) throw new GenesisRequestError('Use a registered tool ID and bounded argument object.');
      if (!policy.capabilities.includes(capability as any)) throw new GenesisRequestError('The host has not granted this tool.');
      if (!def.genesis?.capabilities.includes(capability as any)) throw new GenesisRequestError('Enable the requested Genesis tool before using it.');
      if (effect.type !== 'tool.request' && (!effect.intent || typeof effect.intent !== 'string' || effect.intent.length > 4000)) throw new GenesisRequestError('Give the tool a scene intent under 4,000 characters.');
      if (effect.duration !== undefined && (!Number.isInteger(effect.duration) || effect.duration < 2 || effect.duration > 10)) throw new GenesisRequestError('Use clips from 2 to 10 seconds.');
      if (effect.anchorId && !Object.hasOwn(state.anchors, effect.anchorId)) throw new GenesisRequestError('Choose an existing scene anchor.');
      const ceiling = Math.min(policy.maxActionCostUsd, def.genesis.limits.maxActionCostUsd, effect.type === 'scene.request' ? def.worldVideo.maxCostUsd : 5);
      const cost = effect.maxCostUsd ?? ceiling;
      if (!Number.isFinite(cost) || cost < 0.01 || cost > ceiling || state.reservedCostUsd + cost > Math.min(policy.maxSessionCostUsd, def.genesis.limits.maxSessionCostUsd)) throw new GenesisRequestError('This request exceeds the session spending limit.');
      if (state.jobs.filter(j => ['queued', 'running'].includes(j.status)).length >= Math.min(policy.maxJobs, def.genesis.limits.maxJobs) || state.jobs.length >= 128) throw new GenesisRequestError('This session has reached its job limit.');
      state.jobs.push({ id: effect.id, effect: clone(effect), sourceEventId: event.id, sourceRevision: nextRevision, status: 'queued', maxCostUsd: cost, mediaId: '', error: '', retryCount: 0 });
      state.reservedCostUsd = Math.round((state.reservedCostUsd + cost) * 10000) / 10000;
      if (effect.type !== 'tool.request') { state.stage.visible = true; state.stage.mode = 'generating'; state.stage.overlays = false; state.stage.ownerJobId = effect.id; }
    } else if (effect.type === 'stage.restore' || effect.type === 'stage.show') {
      if (!effect.anchorId || !Object.hasOwn(state.anchors, effect.anchorId)) throw new GenesisRequestError('Restore an existing scene anchor.');
      state.stage = { mode: 'holding', anchorId: effect.anchorId, videoUrl: '', playbackId: '', playedBy: [], overlays: true, ownerJobId: '', visible: true };
    } else if (effect.type === 'stage.play') {
      if (!effect.videoUrl || !policy.validateAssetUrl(effect.videoUrl)) throw new GenesisRequestError('Play a saved storage video.');
      if (effect.anchorId && !Object.hasOwn(state.anchors, effect.anchorId)) throw new GenesisRequestError('Choose an existing playback anchor.');
      state.stage = { ...state.stage, ...(effect.anchorId ? { anchorId: effect.anchorId } : {}), visible: true, mode: 'playing', videoUrl: effect.videoUrl, playbackId: effect.id, playedBy: [], overlays: false, ownerJobId: '' };
    } else if (effect.type === 'players.release') {
      if (!def.participation.seats || !def.participation.seats.slots.some(s => s.id === effect.seatId) || !validId(effect.expectedActorId) || !Number.isInteger(effect.cooldownMs ?? 0) || (effect.cooldownMs ?? 0) < 0 || (effect.cooldownMs ?? 0) > 60000) throw new GenesisRequestError('Release a declared seat with its expected owner and a bounded cooldown.');
    } else if (effect.type === 'timer.set') {
      if (!Number.isInteger(effect.delayMs) || effect.delayMs! < 1000 || effect.delayMs! > 120000 || state.timers.length >= 8) throw new GenesisRequestError('Use up to eight timers from 1 to 120 seconds.');
      state.timers.push({ id: effect.id, dueAt: event.now + effect.delayMs!, data: clone(effect.data || {}) });
    } else throw new GenesisRequestError('Choose a supported Genesis effect.');
    state.effectIds = [...state.effectIds, effect.id].slice(-512);
  }
  state.revision = nextRevision; state.receipts = [...state.receipts, event.id].slice(-256);
  if (JSON.stringify(state).length > 200000) throw new GenesisRequestError('Keep Genesis state below 200 KB.');
  return state;
}
export function genesisView(def: ExperienceDefinition, state: GenesisState, actorId: string, role: string, policy: GenesisHostPolicy = defaultGenesisHostPolicy) {
  return { revision: state.revision, state: clone(state.public), privateState: clone(Object.hasOwn(state.private, actorId) ? state.private[actorId] : {}), window: state.window, votedOptionId: state.ballots[actorId] || '', voteCount: Object.keys(state.ballots).length,
    stage: state.stage, anchor: state.anchors[state.stage.anchorId], actions: genesisActions(def).map(a => ({ ...a, canSubmit: canGenesisAct(def, state, actorId, role, a.id) })),
    jobs: state.jobs.slice(-8).map(j => ({ id: j.id, type: j.effect.type, status: j.status, maxCostUsd: j.maxCostUsd, error: j.error })), reservedCostUsd: state.reservedCostUsd, maxSessionCostUsd: Math.min(policy.maxSessionCostUsd, def.genesis!.limits.maxSessionCostUsd) };
}

/** Also used by the local default preview. Custom controllers use the isolated interpreter. */
export function defaultGenesisController({ state, event, config, participants, anchors, stage }: GenesisContext): GenesisTransition {
  const players = participants.filter(p => p.role === 'player');
  const turn = Number(state.public.turn || 0), active = players[turn % Math.max(1, players.length)];
  const open = (nextTurn = turn): GenesisWindow => {
    const currentActor = players[nextTurn % Math.max(1, players.length)];
    const collective = config.participation.mode === 'group' || config.inputs.every(i => i.kind === 'vote');
    return { id: `input:${event.id}`, mode: collective ? 'collective' : 'individual', actionIds: config.inputs.filter(i => collective ? i.kind === 'vote' : i.kind !== 'vote').map(i => i.id),
      ...(config.participation.turnPolicy === 'sequential' && !collective && currentActor ? { actorIds: [currentActor.id] } : {}),
      ...(collective ? { options: config.choices.map((label, index) => ({ id: `option_${index}`, label })), deadline: event.now + config.roundSeconds * 1000 } : {}) };
  };
  if (['participant.joined', 'participant.left', 'seat.claimed', 'seat.released'].includes(event.type) && stage.mode !== 'holding') return {};
  if (['session.started', 'participant.joined', 'participant.left', 'seat.claimed', 'seat.released'].includes(event.type)) return { window: state.window && !state.window.closed && state.window.mode === 'collective' ? state.window : open() };
  if (event.type === 'action' || event.type === 'vote.resolved') {
    const input = config.inputs.find(i => i.id === event.actionId), data = event.data;
    if (input?.advanceBehavior === 'context_only' || input?.scope === 'conversation') {
      return {};
    }
    const intent = event.type === 'vote.resolved' ? String(data.label) : input?.kind === 'click' ? `Move the camera naturally toward the point at normalized image coordinates (${Number(data.x).toFixed(3)}, ${Number(data.y).toFixed(3)}). Preserve the scene and settle at the destination.` : String(data.text || 'Continue the scene.');
    const publicState = { ...state.public, lastAction: intent, turn: turn + 1 };
    if (config.video.source === 'cached') {
      const currentScene = config.scenes.find(s => s.id === stage.anchorId) || config.scenes[0];
      const hotspot = currentScene?.hotspots.find(h => h.id === data.targetId) || [...(currentScene?.hotspots || [])].sort((a, b) => Math.hypot(a.x - Number(data.x), a.y - Number(data.y)) - Math.hypot(b.x - Number(data.x), b.y - Number(data.y)))[0];
      const nextScene = config.scenes.find(s => s.id === hotspot?.targetSceneId);
      if (!nextScene || !nextScene.imageUrl) throw new GenesisRequestError('Choose a prepared scene with a saved image.');
      return { public: publicState, window: nextScene.videoUrl ? null : open(turn + 1), effects: [{ id: `cached:${event.id}`, type: nextScene.videoUrl ? 'stage.play' : 'stage.show', anchorId: nextScene.id, ...(nextScene.videoUrl ? { videoUrl: nextScene.videoUrl } : {}) }] };
    }
    if (!config.video.enabled) return { public: publicState, window: open(turn + 1) };
    return { public: publicState, window: null, effects: [{ id: `scene:${event.id}`, type: config.video.pacing === 'continuous' ? 'live.direction' : 'scene.request', intent, anchorId: config.video.continuity === 'reset_turn' ? 'start' : stage.anchorId }] };
  }
  if (event.type === 'job.ready') {
    if (event.data.imageUrl && !event.data.videoUrl) return { effects: [{ id: `show:${event.id}`, type: 'stage.show', anchorId: String(event.data.anchorId) }], window: open() };
    return { effects: event.data.videoUrl ? [{ id: `play:${event.id}`, type: 'stage.play', videoUrl: String(event.data.videoUrl) }] : [], window: event.data.videoUrl ? null : open() };
  }
  if (event.type === 'playback.completed') return { effects: [{ id: `hold:${event.id}`, type: 'stage.restore', anchorId: config.video.continuity === 'reset_turn' ? 'start' : String(event.data.anchorId || stage.anchorId) }], window: open() };
  if (event.type === 'job.skipped') return { effects: [{ id: `skip:${event.id}`, type: 'stage.restore', anchorId: stage.anchorId }], window: open() };
  if (event.type === 'job.failed') return { public: { ...state.public, lastError: event.data.error }, window: null };
  return {};
}
