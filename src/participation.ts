import type { ExperienceDefinition } from './experienceDefinition.js';
import type { ExperienceSessionState, ExperienceParticipant } from './experienceSessionCore.js';

/** Identity keys and lease times belong to the host, never to controller state. */
export interface GenesisParticipationState {
  version: 1;
  seats: Array<{ id: string; actorId: string; leaseUntil: number }>;
  queue: string[];
  identities: Record<string, string>;
  cooldowns: Record<string, number>;
}
export type GenesisPlayerOperation = 'claim' | 'release' | 'queue.join' | 'queue.leave';
export interface GenesisPlayerRequest { operation: GenesisPlayerOperation; seatId?: string }
export interface GenesisSeatEvent { type: 'seat.claimed' | 'seat.released' | 'queue.joined' | 'queue.left'; actorId: string; data: Record<string, unknown> }
export const GENESIS_PARTICIPATION_CAPABILITIES = Object.freeze(['seats', 'queue', 'cooldowns', 'presence', 'action-windows']);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const LEASE_MS = 45_000;

export function initializeGenesisParticipation(def: ExperienceDefinition): GenesisParticipationState | undefined {
  return def.participation.seats ? { version: 1, seats: def.participation.seats.slots.map(s => ({ id: s.id, actorId: '', leaseUntil: 0 })), queue: [], identities: {}, cooldowns: {} } : undefined;
}
export function registerGenesisIdentity(state: ExperienceSessionState, actorId: string, identityKey: string) {
  if (!state.participation) return;
  if (!identityKey || identityKey.length > 160 || ['__proto__', 'constructor', 'prototype'].includes(identityKey)) throw new Error('The host must supply a stable participant identity.');
  const existing = state.participation.identities[actorId];
  if (existing && existing !== identityKey) throw new Error('This participant identity is already bound.');
  state.participation.identities[actorId] = identityKey;
}
function refreshStatus(def: ExperienceDefinition, state: ExperienceSessionState) {
  if (state.status === 'ended') return;
  state.status = state.participants.filter(p => p.role === 'player').length >= def.participation.minPlayers ? 'active' : 'waiting_players';
}
function eligible(def: ExperienceDefinition, state: ExperienceSessionState, actorId: string, now: number) {
  const registry = state.participation!, identity = registry.identities[actorId];
  const actor = state.participants.find(p => p.id === actorId);
  return !!actor && !!identity && state.status !== 'ended' && actor.lastSeenAt + LEASE_MS > now
    && (registry.cooldowns[identity] || 0) <= now && !registry.seats.some(s => s.actorId === actorId)
    && registry.seats.filter(s => s.actorId && registry.identities[s.actorId] === identity).length < def.participation.seats!.maxSeatsPerIdentity
    && (def.participation.joinPolicy !== 'lobby' || state.round <= 1)
    && (def.participation.joinPolicy !== 'round_boundary' || !Object.keys(state.pendingActions).length);
}
function claim(def: ExperienceDefinition, state: ExperienceSessionState, actorId: string, seatId: string, now: number, events: GenesisSeatEvent[]) {
  const seat = state.participation!.seats.find(s => s.id === seatId);
  if (!seat) throw new Error('Choose a declared player seat.');
  if (seat.actorId === actorId) return;
  if (seat.actorId) throw new Error('This seat is already occupied.');
  if (!eligible(def, state, actorId, now)) throw new Error('This seat is unavailable. Leave your current seat or wait for your cooldown.');
  seat.actorId = actorId; seat.leaseUntil = now + LEASE_MS;
  state.participation!.queue = state.participation!.queue.filter(id => id !== actorId);
  state.participants.find(p => p.id === actorId)!.role = 'player';
  events.push({ type: 'seat.claimed', actorId, data: { seatId } }); refreshStatus(def, state);
}
function release(def: ExperienceDefinition, state: ExperienceSessionState, seatId: string, now: number, cooldownMs: number, reason: string, events: GenesisSeatEvent[]) {
  const registry = state.participation!, seat = registry.seats.find(s => s.id === seatId)!;
  if (!seat.actorId) return;
  const actorId = seat.actorId, actor = state.participants.find(p => p.id === actorId), identity = registry.identities[actorId];
  seat.actorId = ''; seat.leaseUntil = 0;
  if (actor) actor.role = 'spectator';
  delete state.votes[actorId]; delete state.pendingActions[actorId]; delete state.persistentInputs[actorId];
  if (state.genesis) { delete state.genesis.ballots[actorId]; delete state.genesis.private[actorId]; }
  if (cooldownMs && identity) registry.cooldowns[identity] = Math.max(registry.cooldowns[identity] || 0, now + cooldownMs);
  registry.queue = registry.queue.filter(id => id !== actorId);
  events.push({ type: 'seat.released', actorId, data: { seatId, reason, cooldownUntil: identity ? registry.cooldowns[identity] || 0 : 0 } }); refreshStatus(def, state);
}
function promote(def: ExperienceDefinition, state: ExperienceSessionState, now: number, events: GenesisSeatEvent[]) {
  const registry = state.participation!;
  registry.queue = registry.queue.filter(id => state.participants.some(p => p.id === id && p.lastSeenAt + LEASE_MS > now));
  for (const seat of registry.seats.filter(s => !s.actorId)) {
    const next = registry.queue.find(id => eligible(def, state, id, now));
    if (next) claim(def, state, next, seat.id, now, events);
  }
}
/** Pure reducers. Distributed adapters must commit their returned state atomically. */
export function tickGenesisParticipation(def: ExperienceDefinition, previous: ExperienceSessionState, now = Date.now()) {
  if (!previous.participation) return { state: previous, events: [] as GenesisSeatEvent[] };
  const state = clone(previous), registry = state.participation!, events: GenesisSeatEvent[] = [];
  for (const [identity, until] of Object.entries(registry.cooldowns)) if (until <= now) delete registry.cooldowns[identity];
  for (const seat of registry.seats) if (seat.actorId && seat.leaseUntil <= now) release(def, state, seat.id, now, 0, 'disconnected', events);
  promote(def, state, now, events);
  if (JSON.stringify(registry) === JSON.stringify(previous.participation)) return { state: previous, events };
  state.revision++; return { state, events };
}
export function touchGenesisParticipant(previous: ExperienceSessionState, actorId: string, now = Date.now()) {
  if (!previous.participation) return previous;
  const previousActor = previous.participants.find(p => p.id === actorId);
  if (previousActor && previousActor.lastSeenAt > now - 15000) return previous;
  const state = clone(previous), actor = state.participants.find(p => p.id === actorId);
  if (!actor) throw new Error('Join this room first.');
  actor.lastSeenAt = now;
  const identity=state.participation!.identities[actorId];
  const controlled=state.participants.filter(p=>identity&&state.participation!.identities[p.id]===identity);
  for(const participant of controlled)participant.lastSeenAt=now;
  // A late heartbeat never revives an expired seat.
  for (const seat of state.participation!.seats) if (controlled.some(p=>p.id===seat.actorId) && seat.leaseUntil > now) seat.leaseUntil = now + LEASE_MS;
  return state;
}
export function applyGenesisPlayerRequest(def: ExperienceDefinition, previous: ExperienceSessionState, actorId: string, request: GenesisPlayerRequest, now = Date.now()) {
  if (!def.participation.seats || !previous.participation) throw new Error('This world does not use player seats.');
  if (!request || !['claim', 'release', 'queue.join', 'queue.leave'].includes(request.operation) || Object.keys(request).some(k => !['operation', 'seatId'].includes(k))) throw new Error('Use a supported player request.');
  const state = clone(previous), events: GenesisSeatEvent[] = [], registry = state.participation!;
  if (!state.participants.some(p => p.id === actorId)) throw new Error('Join this room first.');
  if (request.operation === 'claim') {
    if (registry.queue.some(id => id !== actorId && eligible(def, state, id, now))) throw new Error('Join the waiting queue to take the next seat.');
    claim(def, state, actorId, String(request.seatId || ''), now, events);
  } else if (request.operation === 'release') {
    const seat = registry.seats.find(s => s.id === request.seatId);
    if (!seat || seat.actorId !== actorId) throw new Error('You can only leave your own seat.');
    release(def, state, seat.id, now, 0, 'left', events);
  } else if (request.operation === 'queue.join') {
    if (!def.participation.seats.queue || !eligible(def, state, actorId, now)) throw new Error('The waiting queue is unavailable for you.');
    if (!registry.queue.includes(actorId)) { registry.queue.push(actorId); events.push({ type: 'queue.joined', actorId, data: {} }); }
  } else {
    if (registry.queue.includes(actorId)) events.push({ type: 'queue.left', actorId, data: {} });
    registry.queue = registry.queue.filter(id => id !== actorId);
  }
  promote(def, state, now, events); state.revision++;
  return { state, events };
}

/** Opt-in same-identity testing keeps one actor per seat and switches only the caller's control. */
export function prepareGenesisSeatControl(def: ExperienceDefinition, previous: ExperienceSessionState, actorId: string, request: GenesisPlayerRequest, now = Date.now()) {
  if(request?.operation!=='claim'||!def.participation.seats||def.participation.seats.maxSeatsPerIdentity<2||!previous.participation)return {state:previous,actorId};
  const registry=previous.participation,identity=registry.identities[actorId],seat=registry.seats.find(s=>s.id===request.seatId);
  if(!identity||!seat)return {state:previous,actorId};
  if(seat.actorId&&registry.identities[seat.actorId]===identity)return {state:previous,actorId:seat.actorId};
  if(seat.actorId||!registry.seats.some(s=>s.actorId===actorId))return {state:previous,actorId};
  if(registry.seats.filter(s=>s.actorId&&registry.identities[s.actorId]===identity).length>=def.participation.seats.maxSeatsPerIdentity)throw new Error('Your account already controls its allowed seats.');
  const state=clone(previous),root=state.participants.find(p=>registry.identities[p.id]===identity)!;
  const secondaryId=root.id.slice(0,48)+'_seat_'+seat.id.slice(0,40);
  const existing=state.participants.find(p=>p.id===secondaryId);
  if(existing&&registry.identities[secondaryId]!==identity)throw new Error('This trainer identity is unavailable.');
  if(!existing)state.participants.push({...root,id:secondaryId,name:(root.name+' ('+def.participation.seats.slots.find(s=>s.id===seat.id)!.label+')').slice(0,60),role:'spectator',joinedAt:now,lastSeenAt:now});
  state.participation!.identities[secondaryId]=identity;
  return {state,actorId:secondaryId};
}
/** Controller-only operation. Expected owner prevents removing a replacement player. */
export function releaseGenesisSeat(def: ExperienceDefinition, previous: ExperienceSessionState, seatId: string, expectedActorId: string, cooldownMs: number, now = Date.now()) {
  if (!def.participation.seats || !previous.participation || !Number.isInteger(cooldownMs) || cooldownMs < 0 || cooldownMs > 60_000) throw new Error('Use a declared seat and cooldown from 0 to 60 seconds.');
  const seat = previous.participation.seats.find(s => s.id === seatId);
  if (!seat || !expectedActorId || seat.actorId !== expectedActorId) throw new Error('This seat owner changed.');
  const state = clone(previous), events: GenesisSeatEvent[] = [];
  release(def, state, seatId, now, cooldownMs, 'controller', events); promote(def, state, now, events); state.revision++;
  return { state, events };
}
export function genesisParticipationView(def: ExperienceDefinition, state: ExperienceSessionState, actorId: string, now = Date.now()) {
  if (!state.participation || !def.participation.seats) return undefined;
  const registry = state.participation, identity = registry.identities[actorId], canClaim = eligible(def, state, actorId, now);
  return { version: 1 as const, capabilities: [...GENESIS_PARTICIPATION_CAPABILITIES],
    seats: registry.seats.map(s => {
      let claimable=canClaim;
      if(!s.actorId&&identity&&def.participation.seats!.maxSeatsPerIdentity>1&&registry.seats.filter(seat=>seat.actorId&&registry.identities[seat.actorId]===identity).length<def.participation.seats!.maxSeatsPerIdentity){
        const prepared=prepareGenesisSeatControl(def,state,actorId,{operation:'claim',seatId:s.id},now);claimable=eligible(def,prepared.state,prepared.actorId,now);
      }
      return {id:s.id,label:def.participation.seats!.slots.find(slot=>slot.id===s.id)!.label,actorId:s.leaseUntil>now?s.actorId:'',canClaim:claimable&&!s.actorId&&!registry.queue.some(id=>id!==actorId&&eligible(def,state,id,now)),canRelease:s.actorId===actorId&&s.leaseUntil>now,canControl:def.participation.seats!.maxSeatsPerIdentity>1&&Boolean(identity&&s.actorId&&s.actorId!==actorId&&registry.identities[s.actorId]===identity&&s.leaseUntil>now)};
    }),
    queueEnabled: def.participation.seats.queue, queueLength: registry.queue.length, queuePosition: registry.queue.indexOf(actorId) + 1,
    canQueue: def.participation.seats.queue && canClaim, cooldownUntil: identity ? registry.cooldowns[identity] || 0 : 0 };
}
export function genesisParticipantRole(state: ExperienceSessionState, actor: ExperienceParticipant | undefined, now = Date.now()) {
  if (!actor) return 'spectator';
  return state.participation ? state.participation.seats.some(s => s.actorId === actor.id && s.leaseUntil > now) ? 'player' : 'spectator' : actor.role;
}
