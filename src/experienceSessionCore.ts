import { experienceGameActionType, experienceMediaUrl, type ExperienceDefinition, type ExperienceInputBinding } from './experienceDefinition.js';
import { initializeGenesisParticipation, genesisParticipationView, genesisParticipantRole, type GenesisParticipationState } from './participation.js';
import type { GenesisState } from './genesisCore.js';

export interface ExperienceParticipant { id: string; name: string; role: 'player' | 'spectator'; characterId: string; joinedAt: number; lastSeenAt: number }
export interface ExperienceOutcome { id: string; actorId: string; text: string; result: string; revision: number; createdAt: number }
export interface ExperienceOutput { id: string; outcomeId: string; sourceRevision: number; status: 'pending' | 'ready' | 'failed'; playedBy: string[]; prompt: string; imageUrl: string; videoUrl: string; error: string }
export interface ExperienceSessionState {
  genesis?: GenesisState;
  participation?: GenesisParticipationState;
  schemaVersion: 1; definitionVersion: string; revision: number; status: 'active' | 'waiting_players' | 'ended';
  phaseId: string; round: number; roundDeadline: number; seed: number;
  participants: ExperienceParticipant[]; turnIndex: number; sceneId: string;
  scores: Record<string, number>; attempts: Record<string, number>; health: Record<string, number>;
  votes: Record<string, string>; pendingActions: Record<string, { eventId: string; inputBindingId: string; text: string }>;
  persistentInputs: Record<string, Record<string, { text: string; imageUrl: string; lifetime: ExperienceInputBinding['lifetime']; phaseId: string }>>;
  outcomes: ExperienceOutcome[]; output: ExperienceOutput | null; winnerId: string;
}
export interface ExperienceSubmission { eventId: string; inputBindingId: string; expectedRevision?: number; payload: Record<string, unknown> }
const clean = (v: unknown, max = 1200): string => typeof v === 'string' ? v.trim().slice(0, max) : '';
const players = (state: ExperienceSessionState) => state.participants.filter(p => p.role === 'player');
const audienceCanContinue = (def: ExperienceDefinition) => def.participation.mode === 'single' && def.worldVideo.enabled && def.worldVideo.pacing === 'continuous' && def.rules.resolver === 'narrative' && def.inputs.some(input => input.kind === 'vote');
const random = (seed: number, round: number) => { let n = (seed ^ Math.imul(round + 1, 0x45d9f3b)) >>> 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
export function createExperienceSessionState(def: ExperienceDefinition, version: string, seed: number, now = Date.now()): ExperienceSessionState {
  const opening = def.worldVideo.enabled && def.worldVideo.source !== 'generated' && def.scenes[0]?.videoUrl ? { id: `opening_${version}`, outcomeId: '', sourceRevision: 0, status: 'ready' as const, playedBy: [], prompt: '', imageUrl: def.scenes[0].imageUrl, videoUrl: def.scenes[0].videoUrl, error: '' } : null;
  return { schemaVersion: 1, definitionVersion: version, revision: 0, status: 'waiting_players', phaseId: def.flow.entryPhase, round: 1, roundDeadline: now + def.rules.roundSeconds * 1000, seed,
    ...(initializeGenesisParticipation(def) ? { participation: initializeGenesisParticipation(def) } : {}), participants: [], turnIndex: 0, sceneId: def.scenes[0]?.id || '', scores: def.participation.mode === 'single' && ['combat', 'tennis'].includes(def.rules.resolver) ? { _computer: 0 } : {}, attempts: {}, health: def.participation.mode === 'single' && def.rules.resolver === 'combat' ? { _computer: 100 } : {}, votes: {}, pendingActions: {}, persistentInputs: {}, outcomes: [], output: opening, winnerId: '' };
}
export function joinExperienceParticipant(def: ExperienceDefinition, previous: ExperienceSessionState, participant: ExperienceParticipant): ExperienceSessionState {
  const state: ExperienceSessionState = JSON.parse(JSON.stringify(previous));
  if (state.status === 'ended') throw new Error('This session has ended.');
  if (def.participation.seats) participant = { ...participant, role: 'spectator' };
  const existing = state.participants.find(p => p.id === participant.id);
  if (existing) { existing.lastSeenAt = participant.lastSeenAt; return state; }
  if (state.participants.length >= 100) throw new Error('This room has reached its participant limit.');
  if (participant.role === 'player' && players(state).length >= def.participation.maxPlayers) {
    if (!def.participation.spectators) throw new Error('This room is full.');
    participant = { ...participant, role: 'spectator' };
  }
  if (participant.role === 'spectator' && !def.participation.spectators) throw new Error('Spectators are disabled for this experience.');
  if (participant.role === 'player' && def.participation.joinPolicy === 'lobby' && state.round > 1) throw new Error('Join this experience before the first round.');
  if (participant.role === 'player' && def.participation.joinPolicy === 'round_boundary' && Object.keys(state.pendingActions).length) throw new Error('Join after the current round is complete.');
  const names = new Set(state.participants.map(p => p.name)); let name = participant.name, suffix = 2;
  while (names.has(name)) name = `${participant.name.slice(0, 54)} (${suffix++})`;
  participant = { ...participant, name };
  const previousPlayer = activeExperiencePlayer(state);
  state.participants.push(participant);
  if (previousPlayer) state.turnIndex = players(state).findIndex(p => p.id === previousPlayer); state.scores[participant.id] = 0; state.attempts[participant.id] = 0; state.health[participant.id] = 100;
  if (players(state).length >= def.participation.minPlayers || audienceCanContinue(def)) { if (state.status === 'waiting_players') state.roundDeadline = participant.joinedAt + def.rules.roundSeconds * 1000; state.status = 'active'; }
  state.revision += 1; return state;
}
export function activeExperiencePlayer(state: ExperienceSessionState): string { const active = players(state); return active.length ? active[state.turnIndex % active.length].id : ''; }
export function canSubmitExperienceInput(def: ExperienceDefinition, state: ExperienceSessionState, actorId: string, binding: ExperienceInputBinding): boolean {
  const actor = state.participants.find(p => p.id === actorId); if (!actor || state.status !== 'active' || !binding.activePhases.includes(state.phaseId) || !def.flow.phases.find(p => p.id === state.phaseId)?.inputBindingIds.includes(binding.id)) return false;
  if (actor.role === 'spectator' && !['vote', 'social_chat'].includes(binding.purpose)) return false;
  if (binding.advanceBehavior === 'submit_readiness' && binding.kind !== 'vote' && def.participation.turnPolicy === 'sequential' && def.flow.phases.find(p => p.id === state.phaseId)?.completion !== 'all_players' && activeExperiencePlayer(state) !== actorId) return false;
  if (binding.advanceBehavior === 'submit_readiness' && def.worldVideo.pacing === 'input_gated' && (state.output?.status === 'pending' || state.output?.status === 'ready' && state.output.videoUrl && !state.output.playedBy?.includes(actorId))) return false;
  return true;
}
function measured(payload: Record<string, unknown>, key: string, min: number, max: number): number {
  const v = payload[key]; if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`Use a valid ${key} measurement.`); return v;
}
function expirePhaseInputs(state: ExperienceSessionState, phaseId: string): void {
  for (const bindings of Object.values(state.persistentInputs)) for (const [id, input] of Object.entries(bindings)) if (input.lifetime === 'phase' && input.phaseId !== phaseId) delete bindings[id];
}
function resolveGame(def: ExperienceDefinition, state: ExperienceSessionState, actorId: string, payload: Record<string, unknown>): { text: string; result: string } {
  const actor = state.participants.find(p => p.id === actorId)!; const roll = random(state.seed, state.round);
  if (['shootout', 'tennis', 'combat'].includes(def.rules.resolver) && payload.type !== undefined && payload.type !== experienceGameActionType(def)) throw new Error('This action does not match the connected game rules.');
  if (['narrative', 'adventure', 'conversation'].includes(def.rules.resolver)) { const text = clean(payload.text); if (!text) throw new Error('Describe the game action.'); return { text: `${actor.name}: ${text}`, result: 'game_action' }; }
  const data = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data as Record<string, unknown> : payload;
  const aim = measured(data, 'aimX', -1, 1), power = measured(data, 'power', 0, 1), timing = Math.abs(measured(data, 'timingOffsetMs', -2000, 2000));
  state.attempts[actorId] = (state.attempts[actorId] || 0) + 1;
  if (def.rules.resolver === 'shootout') {
    const onTarget = Math.abs(aim) < 0.92 && power >= 0.25 && power <= 0.96 && timing <= 450;
    const quality = Math.min(0.94, 0.4 + Math.abs(aim) * 0.32 + power * 0.28 - timing / 1400);
    const result = !onTarget ? 'miss' : roll < quality ? 'goal' : 'save';
    if (result === 'goal') state.scores[actorId] += 1;
    const roster = players(state); const allTaken = roster.every(p => state.attempts[p.id] >= def.rules.shotsPerPlayer);
    const equalAttempts = roster.every(p => state.attempts[p.id] === state.attempts[roster[0].id]);
    const order = [...roster].sort((a, b) => state.scores[b.id] - state.scores[a.id]);
    if (allTaken && equalAttempts && (order.length === 1 || state.scores[order[0].id] > state.scores[order[1].id])) { state.status = 'ended'; state.winnerId = order[0].id; }
    return { result, text: `${actor.name} takes a ${aim < 0 ? 'left' : 'right'} side penalty. ${result === 'goal' ? 'The ball crosses the goal line and scores.' : result === 'save' ? 'The goalkeeper saves the shot. No goal.' : 'The shot misses the target. No goal.'} The recorded score is ${state.scores[actorId]}.` };
  }
  if (def.rules.resolver === 'combat') {
    const opponent = players(state).find(p => p.id !== actorId) || (def.participation.mode === 'single' ? { id: '_computer' } : undefined);
    const hit = timing <= 350 && power > 0.2 && roll < Math.min(0.95, 0.6 + power * 0.25);
    const damage = hit ? Math.round(8 + power * 18) : 0;
    if (opponent) state.health[opponent.id] = Math.max(0, state.health[opponent.id] - damage);
    state.scores[actorId] += damage;
    if (opponent && state.health[opponent.id] === 0) { state.status = 'ended'; state.winnerId = actorId; }
    let response = '';
    if (opponent?.id === '_computer' && state.health._computer > 0) {
      const retaliation = Math.round(5 + random(state.seed, state.round + 997) * 18);
      state.health[actorId] = Math.max(0, state.health[actorId] - retaliation); state.scores._computer += retaliation;
      response = ` The computer counters for ${retaliation} damage.`;
      if (state.health[actorId] === 0) { state.status = 'ended'; state.winnerId = '_computer'; }
    }
    return { result: hit ? 'hit' : 'blocked', text: `${actor.name} attempts an attack. ${hit ? `The attack lands for ${damage} damage.` : 'The opponent blocks the attack.'}${response}` };
  }
  if (def.rules.resolver === 'tennis') {
    const good = timing < 400 && power > 0.2 && power < 0.95 && Math.abs(aim) < 0.9;
    const point = good && roll < 0.55 + Math.abs(aim) * 0.3;
    const opponent = players(state).find(p => p.id !== actorId) || (def.participation.mode === 'single' ? { id: '_computer' } : undefined);
    const pointWinner = point ? actorId : opponent?.id;
    if (pointWinner) state.scores[pointWinner] = (state.scores[pointWinner] || 0) + 1;
    const roster = [...players(state), ...(def.participation.mode === 'single' ? [{ id: '_computer' }] : [])], order = [...roster].sort((a, b) => state.scores[b.id] - state.scores[a.id]);
    if (order[0] && state.scores[order[0].id] >= 4 && (order.length === 1 || state.scores[order[0].id] - state.scores[order[1].id] >= 2)) { state.status = 'ended'; state.winnerId = order[0].id; }
    return { result: point ? 'point' : 'lost_point', text: `${actor.name} plays a tennis stroke. ${point ? 'The opponent cannot return it and the player wins the point.' : 'The stroke loses the point.'}` };
  }
  throw new Error('This experience needs a registered game resolver.');
}
function commitOutcome(def: ExperienceDefinition, state: ExperienceSessionState, eventId: string, actorId: string, text: string, result: string, now: number): void {
  state.revision += 1;
  const outcome: ExperienceOutcome = { id: eventId, actorId, text, result, revision: state.revision, createdAt: now };
  state.outcomes = [...state.outcomes, outcome].slice(-30);
  const scene = def.scenes.find(s => s.id === state.sceneId);
  const context = Object.entries(state.persistentInputs).map(([id, inputs]) => {
    const actor = state.participants.find(p => p.id === id);
    const text = Object.entries(inputs).filter(([bindingId]) => { const binding = def.inputs.find(i => i.id === bindingId); return binding && binding.scope !== 'conversation' && !['character_appearance', 'conversation', 'social_chat'].includes(binding.purpose); }).map(([bindingId, v]) => `${bindingId}: ${v.text}`).join('; ');
    return text ? `${actor?.name || 'Shared world context'}: ${text}` : '';
  }).filter(Boolean).join('\n').slice(0, 2000);
  const appearances = Object.entries(state.persistentInputs).filter(([id]) => id === '_world' || players(state).some(p => p.id === id)).map(([id, inputs]) => {
    const text = Object.entries(inputs).filter(([bindingId]) => { const binding = def.inputs.find(i => i.id === bindingId); return binding?.purpose === 'character_appearance' && binding.scope !== 'conversation'; }).map(([, v]) => v.text).join('; ').slice(0, def.worldVideo.pacing === 'continuous' ? 250 : 600);
    return text ? `${state.participants.find(p => p.id === id)?.name || 'Shared cast'}: ${text}` : '';
  }).filter(Boolean).join('\n');
  const sceneReference = Object.values(state.persistentInputs).flatMap(inputs => Object.entries(inputs)).find(([id, input]) => { const binding = def.inputs.find(i => i.id === id); return binding?.purpose === 'scene_reference' && binding.scope !== 'conversation' && input.imageUrl; })?.[1];
  const priorFrame = def.worldVideo.continuity === 'continue_scene' ? state.output?.imageUrl : '';
  const history = state.outcomes.slice(-7, -1).map(outcome => outcome.text).join('\n').slice(-2000);
  const gamePlayers = [...players(state), ...(state.scores._computer !== undefined ? [{ id: '_computer', name: 'Computer' }] : [])];
  const gameFacts = ['shootout', 'tennis', 'combat'].includes(def.rules.resolver) ? gamePlayers.map(p => `${p.name}: score ${state.scores[p.id] || 0}, health ${state.health[p.id] || 0}`).join('; ') + (state.winnerId ? `; Match winner: ${gamePlayers.find(p => p.id === state.winnerId)?.name || 'Player'}` : '') : '';
  const prompt = [gameFacts ? `Recorded game state:\n${gameFacts}` : '', `Current outcome:\n${text.slice(0, def.worldVideo.pacing === 'continuous' ? 1600 : 2400)}`, appearances ? `Assigned character appearances:\n${appearances}` : '', context ? `Scoped story context:\n${context}` : '', history ? `Established consequences:\n${history}` : ''].filter(Boolean).join('\n\n');
  state.output = def.worldVideo.enabled ? { id: `output_${eventId}`, outcomeId: eventId, sourceRevision: state.revision, status: def.worldVideo.source === 'cached' || def.worldVideo.source === 'hybrid' && Boolean(scene?.videoUrl) || def.worldVideo.pacing === 'continuous' ? 'ready' : 'pending', playedBy: [], prompt, imageUrl: sceneReference?.imageUrl || scene?.imageUrl || priorFrame || '', videoUrl: scene?.videoUrl || '', error: '' } : null;
  for (const inputs of Object.values(state.persistentInputs)) for (const [id, input] of Object.entries(inputs)) if (input.lifetime === 'one_action') delete inputs[id];
  state.round += 1; state.roundDeadline = now + def.rules.roundSeconds * 1000; state.votes = {}; state.pendingActions = {};
  if (def.participation.turnPolicy === 'sequential' && !['vote', 'phase_completion'].includes(result)) state.turnIndex += 1;
  const phase = def.flow.phases.find(p => p.id === state.phaseId);
  state.phaseId = phase?.next || state.phaseId; expirePhaseInputs(state, state.phaseId);
}
export function applyExperienceSubmission(def: ExperienceDefinition, previous: ExperienceSessionState, actorId: string, event: ExperienceSubmission, now = Date.now()): { state: ExperienceSessionState; outcome: ExperienceOutcome | null } {
  const state: ExperienceSessionState = JSON.parse(JSON.stringify(previous));
  const binding = def.inputs.find(i => i.id === event.inputBindingId);
  if (!binding || !canSubmitExperienceInput(def, state, actorId, binding)) throw new Error('This input is unavailable for your current role or turn.');
  if (binding.kind !== 'vote' && event.expectedRevision !== undefined && event.expectedRevision !== state.revision) throw new Error('The experience changed. Refresh before submitting this action.');
  const payload = event.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Send a valid input payload.');
  if (binding.kind === 'vote') {
    if (now >= state.roundDeadline) {
      if (Object.keys(state.votes).length) throw new Error('This voting round has closed.');
      state.roundDeadline = now + def.rules.roundSeconds * 1000;
    }
    const optionId = clean(payload.optionId, 20); if (!/^option_[0-5]$/.test(optionId) || !def.rules.voteOptions[Number(optionId.slice(7))]) throw new Error('Choose an available voting option.');
    state.votes[actorId] = optionId; state.revision += 1; return { state, outcome: null };
  }
  if (binding.advanceBehavior === 'submit_readiness' && def.flow.phases.find(p => p.id === state.phaseId)?.completion !== 'manual') {
    const missing = def.inputs.find(input => input.required && input.id !== binding.id && input.activePhases.includes(state.phaseId) && !state.persistentInputs[input.scope === 'world' ? '_world' : actorId]?.[input.id]);
    if (missing) throw new Error(`Complete required input ${missing.id} before advancing.`);
  }
  let actionText = clean(payload.text, binding.maxLength), result = 'action';
  if (binding.kind === 'image') {
    if (binding.purpose === 'character_appearance' && !def.characters.allowPhoto) throw new Error('Character photo uploads are disabled.');
    if (!['character_appearance', 'scene_reference'].includes(binding.purpose)) throw new Error('Choose character appearance or scene reference for this image input.');
    const imageUrl = experienceMediaUrl(payload.imageUrl); if (!imageUrl || !actionText) throw new Error('An image and visual character description are required.');
    state.persistentInputs[binding.scope === 'world' ? '_world' : actorId] ||= {};
    state.persistentInputs[binding.scope === 'world' ? '_world' : actorId][binding.id] = { text: actionText, imageUrl, lifetime: binding.lifetime, phaseId: state.phaseId };
    if (binding.advanceBehavior === 'context_only') { state.revision += 1; return { state, outcome: null }; }
  }
  if (binding.kind === 'click') {
    const scene = def.scenes.find(s => s.id === state.sceneId), hotspot = scene?.hotspots.find(h => h.id === payload.targetId);
    if (!hotspot || payload.sceneId !== state.sceneId) throw new Error('Choose a target in the current scene.');
    state.sceneId = hotspot.targetSceneId;
    actionText = hotspot.action || (hotspot.targetSceneId === scene!.id ? hotspot.label : `Enter ${def.scenes.find(s => s.id === hotspot.targetSceneId)?.title || hotspot.label}.`); result = 'scene_transition';
  } else if (binding.kind === 'game') {
    const configured = def.gameBindings.find(g => g.inputBindingId === binding.id);
    if (configured && !configured.allowedActions.includes(clean(payload.type, 80))) throw new Error('This game action is unavailable.');
    const resolved = resolveGame(def, state, actorId, payload); actionText = resolved.text; result = resolved.result;
  } else if (!actionText) throw new Error('Enter a message or action.');
  if (binding.kind !== 'image' && (binding.advanceBehavior === 'context_only' || ['session', 'phase', 'until_replaced', 'profile'].includes(binding.lifetime))) {
    state.persistentInputs[binding.scope === 'world' ? '_world' : actorId] ||= {}; state.persistentInputs[binding.scope === 'world' ? '_world' : actorId][binding.id] = { text: actionText, imageUrl: '', lifetime: binding.lifetime, phaseId: state.phaseId };
  }
  if (binding.advanceBehavior === 'context_only' || binding.purpose === 'conversation' || binding.purpose === 'social_chat') { state.revision += 1; return { state, outcome: null }; }
  const phase = def.flow.phases.find(p => p.id === state.phaseId)!;
  if (phase.completion === 'manual' || phase.completion === 'vote_deadline') {
    state.persistentInputs[binding.scope === 'world' ? '_world' : actorId] ||= {};
    if (binding.kind !== 'image') state.persistentInputs[binding.scope === 'world' ? '_world' : actorId][binding.id] = { text: actionText, imageUrl: '', lifetime: binding.lifetime, phaseId: state.phaseId };
    state.pendingActions[actorId] = { eventId: event.eventId, inputBindingId: binding.id, text: actionText }; state.revision += 1; return { state, outcome: null };
  }
  if (phase.completion === 'all_players' || def.participation.turnPolicy === 'simultaneous') {
    state.pendingActions[actorId] = { eventId: event.eventId, inputBindingId: binding.id, text: actionText }; state.revision += 1;
    if (players(state).some(p => !state.pendingActions[p.id])) return { state, outcome: null };
    actionText = players(state).map(p => `${p.name}: ${state.pendingActions[p.id].text.slice(0, def.worldVideo.pacing === 'continuous' ? 300 : 600)}`).join('\n');
  }
  commitOutcome(def, state, event.eventId, actorId, actionText, result, now);
  return { state, outcome: state.outcomes[state.outcomes.length - 1] };
}
export function closeExperienceVoteRound(def: ExperienceDefinition, previous: ExperienceSessionState, now = Date.now()): ExperienceSessionState {
  if (def.worldVideo.pacing === 'input_gated' && (previous.output?.status === 'pending' || previous.output?.status === 'ready' && previous.output.videoUrl && players(previous).some(p => !previous.output?.playedBy?.includes(p.id)))) return previous;
  if (previous.status !== 'active' || def.flow.phases.find(p => p.id === previous.phaseId)?.completion !== 'vote_deadline' || now < previous.roundDeadline || !def.inputs.some(i => i.kind === 'vote' && i.activePhases.includes(previous.phaseId))) return previous;
  if (!Object.keys(previous.votes).length) return { ...previous, revision: previous.revision + 1, roundDeadline: now + def.rules.roundSeconds * 1000 };
  const state: ExperienceSessionState = JSON.parse(JSON.stringify(previous)), counts = def.rules.voteOptions.map((_, index) => Object.values(state.votes).filter(id => id === `option_${index}`).length);
  const highest = Math.max(...counts), winners = counts.map((count, index) => count === highest ? index : -1).filter(i => i >= 0);
  const winner = def.rules.tieBreak === 'seeded' ? winners[Math.floor(random(state.seed, state.round) * winners.length)] : winners[0];
  commitOutcome(def, state, `vote_${state.round}`, '', def.rules.voteOptions[winner], 'vote', now); return state;
}
export function settleExperienceOutput(previous: ExperienceSessionState, outputId: string, result: { imageUrl?: string; videoUrl?: string; error?: string }): ExperienceSessionState {
  if (!previous.output || previous.output.id !== outputId || previous.output.status !== 'pending') return previous;
  const state: ExperienceSessionState = JSON.parse(JSON.stringify(previous));
  state.output = { ...state.output!, status: result.error ? 'failed' : 'ready', videoUrl: result.videoUrl || '', imageUrl: result.imageUrl || state.output!.imageUrl, error: result.error || '' }; state.revision += 1; return state;
}
export function experienceSessionView(def: ExperienceDefinition, state: ExperienceSessionState, actorId: string) {
  const { seed: _seed, genesis: _genesis, participation: _participation, persistentInputs, pendingActions, ...publicState } = state;
  return { ...publicState, ...(state.participation ? { participation: genesisParticipationView(def, state, actorId) } : {}), output: state.output ? { ...state.output, prompt: '' } : null,
    persistentInputs: { ...(persistentInputs._world || {}), ...(persistentInputs[actorId] || {}) }, pendingActions: Object.keys(pendingActions), actorId, phase: def.flow.phases.find(p => p.id === state.phaseId)!, activePlayerId: activeExperiencePlayer(state),
    role: genesisParticipantRole(state, state.participants.find(p => p.id === actorId)),
    inputs: def.inputs.map(binding => ({ ...binding, canSubmit: canSubmitExperienceInput(def, state, actorId, binding), options: binding.kind === 'vote' ? def.rules.voteOptions.map((label, index) => ({ id: `option_${index}`, label })) : [] })),
    appearances: Object.fromEntries(Object.entries(persistentInputs).filter(([id]) => id === '_world' || players(state).some(p => p.id === id)).map(([id, values]) => [id, Object.entries(values).filter(([bindingId, v]) => { const binding = def.inputs.find(i => i.id === bindingId); return v.imageUrl && binding?.purpose === 'character_appearance' && binding.scope !== 'conversation'; }).map(([, v]) => ({ imageUrl: v.imageUrl, text: v.text }))])),
  };
}

export function completeExperiencePlayback(previous: ExperienceSessionState, actorId: string, outputId: string): ExperienceSessionState {
  if (!previous.participants.some(p => p.id === actorId)) throw new Error('Join the experience before acknowledging playback.');
  if (previous.output?.id !== outputId || previous.output.status !== 'ready') throw new Error('This video has changed.');
  if (previous.output.playedBy?.includes(actorId)) return previous;
  const state: ExperienceSessionState = JSON.parse(JSON.stringify(previous));
  state.output!.playedBy = [...(state.output!.playedBy || []), actorId]; state.revision += 1;
  return state;
}
export function advanceExperiencePhase(def: ExperienceDefinition, previous: ExperienceSessionState, actorId: string, eventId: string, expectedRevision?: number, now = Date.now()): ExperienceSessionState {
  const phase = def.flow.phases.find(p => p.id === previous.phaseId);
  if (previous.status !== 'active' || phase?.completion !== 'manual' || !previous.participants.some(p => p.id === actorId && p.role === 'player')) throw new Error('This phase cannot advance.');
  if (expectedRevision !== undefined && previous.revision !== expectedRevision) throw new Error('The phase changed. Refresh before continuing.');
  if (def.worldVideo.enabled && def.worldVideo.pacing === 'input_gated' && (previous.output?.status === 'pending' || previous.output?.status === 'ready' && previous.output.videoUrl && players(previous).some(p => !previous.output?.playedBy?.includes(p.id)))) throw new Error('Finish the current video or continue with its recorded result before advancing the phase.');
  for (const player of players(previous)) for (const input of def.inputs.filter(i => i.required && phase.inputBindingIds.includes(i.id))) {
    if (!previous.persistentInputs[input.scope === 'world' ? '_world' : player.id]?.[input.id] && previous.pendingActions[player.id]?.inputBindingId !== input.id) throw new Error(`${player.name} needs to complete ${input.id}.`);
  }
  const state: ExperienceSessionState = JSON.parse(JSON.stringify(previous));
  const text = players(state).map(p => state.pendingActions[p.id]?.text || '').filter(Boolean).join('\n');
  if (text) commitOutcome(def, state, eventId, actorId, text, 'phase_completion', now);
  else { state.phaseId = phase.next; expirePhaseInputs(state, state.phaseId); state.revision += 1; state.roundDeadline = now + def.rules.roundSeconds * 1000; }
  return state;
}

export function leaveExperienceParticipant(def: ExperienceDefinition, previous: ExperienceSessionState, actorId: string): ExperienceSessionState {
  const state: ExperienceSessionState = JSON.parse(JSON.stringify(previous));
  const participant = state.participants.find(p => p.id === actorId); if (!participant) throw new Error('This participant is unavailable.');
  const activeId = activeExperiencePlayer(state); participant.role = 'spectator'; delete state.votes[actorId]; delete state.pendingActions[actorId]; delete state.persistentInputs[actorId];
  state.turnIndex = Math.max(0, players(state).findIndex(p => p.id === activeId));
  if (state.status !== 'ended' && players(state).length < def.participation.minPlayers && !audienceCanContinue(def)) { state.status = 'waiting_players'; state.pendingActions = {}; }
  state.revision += 1; return state;
}
