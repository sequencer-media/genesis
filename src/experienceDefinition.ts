import { normalizeGenesisConfig, type GenesisConfigField } from './config.js';
/** Creative content limits, independent of chat filtering and provider safety checks. */
export interface ExperienceContentPolicy {
  violence: 'none' | 'mild' | 'moderate';
  nudity: 'none' | 'non_explicit';
  sexualThemes: 'none' | 'mild';
  language: 'none' | 'mild' | 'strong';
  substances: 'none' | 'mild';
  frighteningContent: 'none' | 'mild' | 'intense';
}

export const EXPERIENCE_CONTENT_CATEGORIES = [
  { key: 'violence', label: 'Violence', options: [{ value: 'none', label: 'None' }, { value: 'mild', label: 'Mild' }, { value: 'moderate', label: 'Moderate' }] },
  { key: 'nudity', label: 'Nudity', options: [{ value: 'none', label: 'None' }, { value: 'non_explicit', label: 'Non-explicit' }] },
  { key: 'sexualThemes', label: 'Sexual themes', options: [{ value: 'none', label: 'None' }, { value: 'mild', label: 'Mild references' }] },
  { key: 'language', label: 'Language', options: [{ value: 'none', label: 'Clean' }, { value: 'mild', label: 'Mild' }, { value: 'strong', label: 'Strong' }] },
  { key: 'substances', label: 'Alcohol and drugs', options: [{ value: 'none', label: 'None' }, { value: 'mild', label: 'Brief references' }] },
  { key: 'frighteningContent', label: 'Frightening content', options: [{ value: 'none', label: 'None' }, { value: 'mild', label: 'Mild' }, { value: 'intense', label: 'Intense' }] },
] as const;

export const EXPERIENCE_CONTENT_PROFILES = [
  { id: 'general', label: 'All ages', policy: { violence: 'none', nudity: 'none', sexualThemes: 'none', language: 'none', substances: 'none', frighteningContent: 'none' } },
  { id: 'pg', label: 'PG', policy: { violence: 'mild', nudity: 'none', sexualThemes: 'none', language: 'mild', substances: 'none', frighteningContent: 'mild' } },
  { id: 'teen', label: 'Teen', policy: { violence: 'moderate', nudity: 'none', sexualThemes: 'mild', language: 'mild', substances: 'mild', frighteningContent: 'mild' } },
] as const satisfies readonly { id: string; label: string; policy: ExperienceContentPolicy }[];

export function normalizeExperienceContentPolicy(value: unknown): ExperienceContentPolicy | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Provide world content limits as an object.');
  const raw = value as Record<string, unknown>, result: Record<string, string> = {};
  for (const category of EXPERIENCE_CONTENT_CATEGORIES) {
    const allowed: readonly string[] = category.options.map(option => option.value);
    const selected = raw[category.key] ?? EXPERIENCE_CONTENT_PROFILES[1].policy[category.key];
    if (typeof selected !== 'string' || !allowed.includes(selected)) throw new Error(`Choose an available ${category.label.toLowerCase()} limit.`);
    result[category.key] = selected;
  }
  return result as unknown as ExperienceContentPolicy;
}

export function experienceContentProfile(policy: ExperienceContentPolicy | undefined): string {
  if (!policy) return '';
  return EXPERIENCE_CONTENT_PROFILES.find(profile => EXPERIENCE_CONTENT_CATEGORIES.every(category => profile.policy[category.key] === policy[category.key]))?.id || 'custom';
}

export function experienceContentPolicyPrompt(value: unknown): string {
  const policy = normalizeExperienceContentPolicy(value);
  if (!policy) return '';
  const limits: Record<keyof ExperienceContentPolicy, Record<string, string>> = {
    violence: { none: 'Avoid physical violence, injury and gore.', mild: 'Allow brief cartoon or non-graphic action. Avoid blood, gore, injury detail and cruelty.', moderate: 'Allow non-graphic conflict. Avoid gore, torture and realistic injury detail.' },
    nudity: { none: 'Keep characters appropriately clothed. Avoid nudity.', non_explicit: 'Allow only brief non-sexual, non-explicit nudity. Avoid exposed genitals.' },
    sexualThemes: { none: 'Avoid sexual themes and sexual behavior.', mild: 'Allow mild romantic references. Avoid sexual acts and sexualized imagery.' },
    language: { none: 'Use clean language. Avoid profanity and slurs.', mild: 'Allow occasional mild language. Avoid strong profanity and slurs.', strong: 'Strong language may occur. Avoid targeted hateful slurs.' },
    substances: { none: 'Avoid alcohol, smoking, drugs and references to their use.', mild: 'Allow brief substance references. Avoid instructional or glamorized drug use.' },
    frighteningContent: { none: 'Keep the mood reassuring. Avoid horror, threats and disturbing imagery.', mild: 'Allow mild suspense. Avoid intense horror and disturbing imagery.', intense: 'Allow intense suspense. Avoid graphic disturbing imagery.' },
  };
  return ['WORLD CONTENT LIMITS: Apply these limits to every generated scene and spoken line. They take priority over conflicting story, player, vote or game directions. Adapt conflicting actions into an appropriate equivalent.', ...EXPERIENCE_CONTENT_CATEGORIES.map(category => limits[category.key][policy[category.key]])].join('\n');
}

/** Portable, provider independent experience contract shared by authoring and playback. */
export const EXPERIENCE_INPUT_KINDS = ['text', 'vote', 'voice', 'image', 'click', 'game'] as const;
export type ExperienceInputKind = typeof EXPERIENCE_INPUT_KINDS[number];
export type ExperienceVideoMode = 'none' | 'continuous' | 'input_gated' | 'cached';
export type ExperienceLifetime = 'one_action' | 'phase' | 'session' | 'until_replaced' | 'profile';
export interface ExperienceInputBinding {
  id: string; kind: ExperienceInputKind;
  purpose: 'world_action' | 'conversation' | 'social_chat' | 'character_appearance' | 'scene_reference' | 'vote' | 'navigation' | 'game_command' | 'player_instruction';
  scope: 'player' | 'world' | 'conversation'; lifetime: ExperienceLifetime;
  activePhases: string[]; required: boolean; maxLength: number;
  advanceBehavior: 'context_only' | 'submit_readiness';
}
export interface ExperienceInterfaceControl { id: string; inputBindingId: string; component: 'auto' | 'text' | 'voice' | 'upload' | 'vote' | 'hotspots' | 'game'; label: string }
export interface ExperienceOverlayRegion { x: number; y: number; width: number; height: number }
export interface ExperienceInterfaceDefinition {
  mode: 'default' | 'composed' | 'custom'; layout: 'stage' | 'gallery' | 'carousel' | 'room' | 'split';
  theme: { primaryColor: string; backgroundColor: string; textColor: string };
  placement: 'overlay' | 'panel' | 'stage'; controls: ExperienceInterfaceControl[];
  packageVersion: string; fallback: 'default';
  handledInputBindingIds?: string[];
  overlayRegion?: ExperienceOverlayRegion;
  /** Width divided by height for the media stage, independent of generated media dimensions. */
  stageAspectRatio?: number;
  chat?: { presentation: 'minimized' | 'open' | 'disabled'; reactions: boolean };
}
export interface ExperienceScene {
  id: string; title: string; imageUrl: string; videoUrl: string;
  hotspots: Array<{ id: string; label: string; x: number; y: number; targetSceneId: string; action: string }>;
}
export interface ExperienceGameBinding { inputBindingId: string; gameId: string; versionId: string; placement: 'overlay' | 'panel' | 'stage'; allowedActions: string[]; overlayRegion?: ExperienceOverlayRegion }
export type GenesisCapability = 'scene.request' | 'image.request' | 'live.direction' | `tool.${string}`;
export interface GenesisAction {
  id: string; inputBindingId: string; label: string;
  fields: Record<string, { type: 'string' | 'number' | 'boolean'; required?: boolean; min?: number; max?: number; maxLength?: number }>;
}
export interface GenesisDefinition {
  version: 1; packageVersion: string; controller: 'default' | 'custom';
  capabilities: GenesisCapability[]; actions: GenesisAction[]; initialState: Record<string, unknown>;
  limits: { maxJobs: number; maxSessionCostUsd: number; maxActionCostUsd: number };
  playbackCompletion: 'first_player' | 'all_players';
  worldPrompt?: string; configSchema?: Record<string, GenesisConfigField>; config?: Record<string, string | number | boolean>;
}
export interface ExperienceDefinition {
  schemaVersion: 2; presetId: string;
  genesis?: GenesisDefinition;
  contentPolicy?: ExperienceContentPolicy;
  participation: { mode: 'single' | 'multiplayer' | 'group'; minPlayers: number; maxPlayers: number; spectators: boolean; turnPolicy: 'sequential' | 'simultaneous' | 'first_input'; joinPolicy: 'lobby' | 'round_boundary' | 'drop_in'; room?: 'shared' | 'private'; seats?: { version: 1; slots: Array<{ id: string; label: string }>; queue: boolean; maxSeatsPerIdentity: number } };
  worldVideo: { enabled: boolean; pacing: 'continuous' | 'input_gated'; source: 'generated' | 'cached' | 'hybrid'; idlePresentation: 'hold_frame' | 'image' | 'loop'; continuity: 'continue_scene' | 'reset_turn'; modelId: string; maxCostUsd: number; chunkIntervalSeconds?: number; };
  inputs: ExperienceInputBinding[];
  characters: { selectionEnabled: boolean; display: 'grid' | 'carousel' | 'room'; allowPhoto: boolean; appearanceLifetime: 'session' | 'profile'; conversationHistory: 'session' | 'persistent' };
  interface: ExperienceInterfaceDefinition;
  rules: { resolver: 'narrative' | 'shootout' | 'tennis' | 'combat' | 'adventure' | 'conversation'; roundSeconds: number; voteOptions: string[]; tieBreak: 'first' | 'seeded'; shotsPerPlayer: number; };
  flow: { entryPhase: string; phases: Array<{ id: string; title: string; inputBindingIds: string[]; next: string; completion: 'first_input' | 'all_players' | 'vote_deadline' | 'manual' }> };
  scenes: ExperienceScene[]; gameBindings: ExperienceGameBinding[];
}
export interface ExperiencePreset { id: string; title: string; description: string; category: string; resolver: ExperienceDefinition['rules']['resolver']; videoMode: ExperienceVideoMode; multiplayer: boolean; inputs: ExperienceInputKind[]; layout: ExperienceInterfaceDefinition['layout'] }
export const EXPERIENCE_PRESETS: readonly ExperiencePreset[] = [
  { id: 'audience_show', title: 'Audience show', description: 'A continuous story guided by audience votes.', category: 'show', resolver: 'narrative', videoMode: 'continuous', multiplayer: false, inputs: ['vote', 'text'], layout: 'stage' },
  { id: 'character_duel', title: 'Custom character combat', description: 'Choose a character, time attacks, and play through each round.', category: 'game', resolver: 'combat', videoMode: 'input_gated', multiplayer: true, inputs: ['game', 'image', 'text'], layout: 'stage' },
  { id: 'tennis', title: 'Tennis simulator', description: 'Aim and time strokes with a shared scoreboard.', category: 'game', resolver: 'tennis', videoMode: 'input_gated', multiplayer: true, inputs: ['game', 'image'], layout: 'stage' },
  { id: 'penalty_shootout', title: 'World Cup shootout', description: 'Aim your shot, time the kick, and alternate turns.', category: 'game', resolver: 'shootout', videoMode: 'input_gated', multiplayer: true, inputs: ['game', 'image'], layout: 'stage' },
  { id: 'open_world', title: 'Open world adventure', description: 'Explore a city, meet characters, and shape the story.', category: 'exploration', resolver: 'narrative', videoMode: 'input_gated', multiplayer: false, inputs: ['text', 'voice', 'click', 'image'], layout: 'stage' },
  { id: 'oval_office', title: 'Oval Office advice', description: 'Choose an advisor for a private office conversation.', category: 'learning', resolver: 'conversation', videoMode: 'none', multiplayer: false, inputs: ['text', 'voice'], layout: 'room' },
  { id: 'therapist_office', title: 'Therapist office', description: 'A quiet space for private character conversations.', category: 'learning', resolver: 'conversation', videoMode: 'none', multiplayer: false, inputs: ['text', 'voice'], layout: 'room' },
  { id: 'avatar_gallery', title: 'Avatar gallery', description: 'Browse characters and choose who to talk with.', category: 'learning', resolver: 'conversation', videoMode: 'none', multiplayer: false, inputs: ['text', 'voice'], layout: 'gallery' },
  { id: 'cached_adventure', title: 'Point and click adventure', description: 'Explore prepared scenes through choices and hotspots.', category: 'exploration', resolver: 'adventure', videoMode: 'cached', multiplayer: false, inputs: ['click', 'text'], layout: 'stage' },
] as const;
const record = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
const text = (v: unknown, fallback = '', max = 240): string => typeof v === 'string' ? v.trim().slice(0, max) : fallback;
const number = (v: unknown, fallback: number, min: number, max: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
const choice = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => {
  if (v === undefined) return fallback;
  if (!values.includes(v as T)) throw new Error(`Choose an available option: ${values.join(', ')}.`);
  return v as T;
};
const ids = (v: unknown, max = 16): string[] => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string').map(x => text(x, '', 80)))].slice(0, max) : [];
const color = (v: unknown, fallback: string): string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
export function experienceId(v: unknown): string { const id = text(v, '', 128); if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || ['__proto__', 'prototype', 'constructor'].includes(id)) throw new Error('Choose a valid experience reference.'); return id; }
export function experienceMediaUrl(v: unknown): string {
  const url = text(v, '', 4096); if (!url) return '';
  if (/^\/?assets\/[A-Za-z0-9_./-]+$/.test(url) && !url.includes('..')) return url;
  try { const parsed = new URL(url); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && (!parsed.port || parsed.port === '443') && parsed.hostname.length > 0) return url; } catch {}
  throw new Error('Use an HTTPS media URL or a relative assets/ reference.');
}
export function experienceVideoMode(def: ExperienceDefinition): ExperienceVideoMode {
  return !def.worldVideo.enabled ? 'none' : def.worldVideo.source === 'cached' ? 'cached' : def.worldVideo.pacing === 'continuous' ? 'continuous' : 'input_gated';
}
/** Nominal continuous-stream cadence. Providers report the exact generated duration. */
export const DEFAULT_STREAM_CHUNK_INTERVAL_SECONDS = 14;
export const DEFAULT_STAGE_ASPECT_RATIO = 16 / 9;
export function normalizeStageAspectRatio(value: unknown): number {
  if (value === undefined) return DEFAULT_STAGE_ASPECT_RATIO;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < .25 || value > 4) throw new Error('Use a stage aspect ratio from 0.25 to 4 (width divided by height).');
  return value;
}
export function normalizeStreamChunkIntervalSeconds(value: unknown): number {
  if (value === undefined) return DEFAULT_STREAM_CHUNK_INTERVAL_SECONDS;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 2 || value > 30) throw new Error('Use a stream chunk interval from 2 to 30 seconds.');
  return value;
}
export function experienceGameActionType(def: ExperienceDefinition): string {
  return def.rules.resolver === 'shootout' ? 'shot.attempt' : def.rules.resolver === 'tennis' ? 'tennis.stroke' : def.rules.resolver === 'combat' ? 'combat.attack' : 'world.action';
}
export function updatedExperienceGameBinding(def: ExperienceDefinition, inputBindingId: string, gameId: string, versionId: string): ExperienceGameBinding {
  const previous = def.gameBindings.find(binding => binding.inputBindingId === inputBindingId);
  return { inputBindingId, gameId, versionId, placement: previous?.placement || 'overlay', overlayRegion: previous?.overlayRegion || { x: 0, y: 0.75, width: 1, height: 0.25 }, allowedActions: previous?.allowedActions || [experienceGameActionType(def)] };
}
export function setExperienceVideoMode(def: ExperienceDefinition, mode: ExperienceVideoMode): ExperienceDefinition {
  return { ...def, worldVideo: { ...def.worldVideo, enabled: mode !== 'none', pacing: mode === 'continuous' ? 'continuous' : 'input_gated', source: mode === 'cached' ? 'cached' : 'generated' } };
}
export function defaultInput(kind: ExperienceInputKind, conversation = false): ExperienceInputBinding {
  const conversationInput = conversation && (kind === 'text' || kind === 'voice');
  return { id: kind === 'image' ? 'player_appearance' : kind === 'game' ? 'game_controls' : kind === 'vote' ? 'audience_choice' : kind === 'click' ? 'exploration_target' : conversation ? `avatar_${kind}` : `player_${kind}`,
    kind, purpose: kind === 'image' ? 'character_appearance' : kind === 'game' ? 'game_command' : kind === 'vote' ? 'vote' : kind === 'click' ? 'navigation' : conversation ? 'conversation' : 'world_action',
    scope: conversationInput ? 'conversation' : kind === 'vote' ? 'world' : 'player', lifetime: kind === 'image' ? 'session' : 'one_action',
    activePhases: kind === 'image' ? ['setup', 'action'] : ['action'], required: false, maxLength: 1200, advanceBehavior: kind === 'image' || conversationInput ? 'context_only' : 'submit_readiness' };
}
export function createExperienceDefinition(presetId = 'audience_show'): ExperienceDefinition {
  const preset = EXPERIENCE_PRESETS.find(p => p.id === presetId); if (!preset) throw new Error('Choose an available experience preset.');
  const inputs = preset.inputs.map(kind => defaultInput(kind, preset.resolver === 'conversation'));
  if (preset.id === 'audience_show') {
    const instruction = inputs.find(i => i.kind === 'text')!;
    instruction.purpose = 'player_instruction'; instruction.advanceBehavior = 'context_only';
  }
  const def: ExperienceDefinition = {
    schemaVersion: 2, presetId: preset.id, contentPolicy: { ...EXPERIENCE_CONTENT_PROFILES[1].policy },
    participation: { mode: preset.multiplayer ? 'multiplayer' : 'single', minPlayers: preset.multiplayer ? 2 : 1, maxPlayers: preset.multiplayer ? 2 : 1, spectators: true, turnPolicy: ['shootout', 'combat', 'tennis'].includes(preset.resolver) ? 'sequential' : 'first_input', joinPolicy: 'round_boundary' },
    worldVideo: { enabled: true, pacing: 'continuous', source: 'generated', idlePresentation: 'hold_frame', continuity: ['shootout', 'tennis'].includes(preset.resolver) ? 'reset_turn' : 'continue_scene', modelId: 'prunaai-p-video-2-pro', maxCostUsd: 0.5, chunkIntervalSeconds: DEFAULT_STREAM_CHUNK_INTERVAL_SECONDS },
    inputs, characters: { selectionEnabled: true, display: preset.layout === 'room' ? 'room' : 'grid', allowPhoto: preset.inputs.includes('image'), appearanceLifetime: 'session', conversationHistory: 'persistent' },
    interface: { mode: 'default', layout: preset.layout, theme: { primaryColor: '#FAFAFA', backgroundColor: '#09090B', textColor: '#FAFAFA' }, placement: 'panel', controls: inputs.map(input => ({ id: `control_${input.id}`, inputBindingId: input.id, component: 'auto', label: '' })), packageVersion: '', fallback: 'default', handledInputBindingIds: [], overlayRegion: { x: 0, y: 0, width: 1, height: 1 } },
    rules: { resolver: preset.resolver, roundSeconds: 20, voteOptions: ['Explore further', 'Meet a character', 'Follow the unexpected'], tieBreak: 'first', shotsPerPlayer: 5 },
    flow: { entryPhase: 'action', phases: [ { id: 'setup', title: 'Choose your character', inputBindingIds: inputs.filter(i => i.kind === 'image').map(i => i.id), next: 'action', completion: 'manual' }, { id: 'action', title: preset.resolver === 'conversation' ? 'Conversation' : 'Your next action', inputBindingIds: inputs.map(i => i.id), next: 'action', completion: preset.inputs.includes('vote') ? 'vote_deadline' : 'first_input' } ] },
    scenes: [], gameBindings: [],
  };
  if (preset.id === 'cached_adventure') def.scenes = [
    { id: 'entrance', title: 'The entrance', imageUrl: '', videoUrl: '', hotspots: [{ id: 'courtyard_door', label: 'Explore the courtyard', x: 0.25, y: 0.55, targetSceneId: 'courtyard', action: 'Enter the courtyard through the open door.' }, { id: 'study_door', label: 'Enter the study', x: 0.65, y: 0.55, targetSceneId: 'study', action: 'Open the study door and step inside.' }] },
    { id: 'courtyard', title: 'The courtyard', imageUrl: '', videoUrl: '', hotspots: [{ id: 'return', label: 'Return to the entrance', x: 0.5, y: 0.7, targetSceneId: 'entrance', action: 'Return to the entrance.' }] },
    { id: 'study', title: 'The study', imageUrl: '', videoUrl: '', hotspots: [{ id: 'return', label: 'Return to the entrance', x: 0.5, y: 0.7, targetSceneId: 'entrance', action: 'Return to the entrance.' }] },
  ];
  return setExperienceVideoMode(def, preset.videoMode);
}
export function legacyExperienceDefinition(settings: Record<string, any>): ExperienceDefinition {
  const preset = settings.type === 'multiplayer' ? 'open_world' : settings.type === 'learning' ? 'avatar_gallery' : settings.type === 'exploration' ? 'open_world' : 'audience_show';
  const def = createExperienceDefinition(preset);
  delete def.contentPolicy; // Existing worlds acquire limits when their creator selects them.
  if (settings.type === 'multiplayer') { def.participation.mode = 'multiplayer'; def.participation.maxPlayers = number(settings.multiplayerPlayerCount, 2, 2, 4); def.worldVideo.pacing = 'continuous'; }
  def.rules.roundSeconds = number(settings.roundSeconds, 15, 5, 120);
  return def;
}
export function normalizeExperienceOverlayRegion(value: unknown): ExperienceOverlayRegion {
  if (value === undefined) return { x: 0, y: 0, width: 1, height: 1 };
  const region = record(value);
  if (['x', 'y', 'width', 'height'].some(key => typeof region[key] !== 'number' || !Number.isFinite(region[key])) || region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 || region.x + region.width > 1.000001 || region.y + region.height > 1.000001) throw new Error('Overlay regions must fit within the stage, using coordinates from 0 to 1.');
  return { x: region.x, y: region.y, width: region.width, height: region.height };
}
export function normalizeExperienceDefinition(value: unknown): ExperienceDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Provide an experience definition object.');
  const raw = record(value); const base = createExperienceDefinition(text(raw.presetId, 'audience_show'));
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 2) throw new Error('Use experience schema version 2.');
  for (const [name, items, max] of [['inputs', raw.inputs, 16], ['scenes', raw.scenes, 64], ['game bindings', raw.gameBindings, 6], ['interface controls', raw.interface?.controls, 24], ['flow phases', raw.flow?.phases, 12], ['vote options', raw.rules?.voteOptions, 6]] as const) {
    if (items !== undefined && !Array.isArray(items)) throw new Error(`Provide ${name} as an array.`);
    if (Array.isArray(items) && items.length > max) throw new Error(`Use at most ${max} ${name}.`);
  }
  for (const scene of raw.scenes || []) if (scene?.hotspots !== undefined && (!Array.isArray(scene.hotspots) || scene.hotspots.length > 16)) throw new Error('Use an array of at most 16 hotspots per scene.');
  for (const game of raw.gameBindings || []) if (game?.allowedActions !== undefined && (!Array.isArray(game.allowedActions) || game.allowedActions.length > 16)) throw new Error('Use an array of at most 16 game action types.');
  if (raw.interface?.handledInputBindingIds !== undefined && (!Array.isArray(raw.interface.handledInputBindingIds) || raw.interface.handledInputBindingIds.length > 16 || raw.interface.handledInputBindingIds.some((id: unknown) => typeof id !== 'string'))) throw new Error('Declare up to 16 custom interface input IDs.');
  const p = record(raw.participation), v = record(raw.worldVideo), c = record(raw.characters), ui = record(raw.interface), theme = record(ui.theme), rules = record(raw.rules), flow = record(raw.flow);
  for (const capacity of [p.minPlayers, p.maxPlayers]) if (capacity !== undefined && (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1 || capacity > (raw.genesis ? 100 : 4))) throw new Error(`Player counts must be whole numbers from 1 to ${raw.genesis ? 100 : 4}.`);
  const inputs: ExperienceInputBinding[] = Array.isArray(raw.inputs) ? raw.inputs.slice(0, 16).map((x: unknown) => {
    const i = record(x); const kind = choice(i.kind, EXPERIENCE_INPUT_KINDS, 'text'); const fallback = defaultInput(kind);
    return { id: experienceId(i.id), kind, purpose: choice(i.purpose, ['world_action', 'conversation', 'social_chat', 'character_appearance', 'scene_reference', 'vote', 'navigation', 'game_command', 'player_instruction'], fallback.purpose), scope: choice(i.scope, ['player', 'world', 'conversation'], fallback.scope), lifetime: choice(i.lifetime, ['one_action', 'phase', 'session', 'until_replaced', 'profile'], fallback.lifetime), activePhases: ids(i.activePhases).length ? ids(i.activePhases) : ['action'], required: i.required === true, maxLength: number(i.maxLength, 1200, 1, 4000), advanceBehavior: choice(i.advanceBehavior, ['context_only', 'submit_readiness'], fallback.advanceBehavior) };
  }) : base.inputs;
  const def: ExperienceDefinition = {
    schemaVersion: 2, presetId: base.presetId,
    ...(raw.genesis !== undefined ? { genesis: normalizeGenesisDefinition(raw.genesis) } : {}),
    ...(raw.contentPolicy !== undefined ? { contentPolicy: normalizeExperienceContentPolicy(raw.contentPolicy) } : raw.inputs === undefined ? { contentPolicy: base.contentPolicy } : {}),
    participation: { mode: choice(p.mode, raw.genesis ? ['single', 'multiplayer', 'group'] : ['single', 'multiplayer'], base.participation.mode), minPlayers: number(p.minPlayers, base.participation.minPlayers, 1, raw.genesis ? 100 : 4), maxPlayers: number(p.maxPlayers, base.participation.maxPlayers, 1, raw.genesis ? 100 : 4), spectators: p.spectators !== false, turnPolicy: choice(p.turnPolicy, ['sequential', 'simultaneous', 'first_input'], base.participation.turnPolicy), joinPolicy: choice(p.joinPolicy, ['lobby', 'round_boundary', 'drop_in'], base.participation.joinPolicy) },
    worldVideo: { chunkIntervalSeconds: normalizeStreamChunkIntervalSeconds(v.chunkIntervalSeconds), enabled: typeof v.enabled === 'boolean' ? v.enabled : base.worldVideo.enabled, pacing: choice(v.pacing, ['continuous', 'input_gated'], base.worldVideo.pacing), source: choice(v.source, ['generated', 'cached', 'hybrid'], base.worldVideo.source), idlePresentation: choice(v.idlePresentation, ['hold_frame', 'image', 'loop'], 'hold_frame'), continuity: choice(v.continuity, ['continue_scene', 'reset_turn'], base.worldVideo.continuity), modelId: text(v.modelId, 'prunaai-p-video-2-pro', 128), maxCostUsd: typeof v.maxCostUsd === 'number' && Number.isFinite(v.maxCostUsd) ? Math.max(0.01, Math.min(5, v.maxCostUsd)) : 0.5 },
    inputs, characters: { selectionEnabled: c.selectionEnabled !== false, display: choice(c.display, ['grid', 'carousel', 'room'], base.characters.display), allowPhoto: typeof c.allowPhoto === 'boolean' ? c.allowPhoto : inputs.some(i => i.purpose === 'character_appearance'), appearanceLifetime: choice(c.appearanceLifetime, ['session', 'profile'], 'session'), conversationHistory: choice(c.conversationHistory, ['session', 'persistent'], 'persistent') },
    interface: { ...(ui.stageAspectRatio !== undefined ? { stageAspectRatio: normalizeStageAspectRatio(ui.stageAspectRatio) } : {}), mode: choice(ui.mode, ['default', 'composed', 'custom'], 'default'), layout: choice(ui.layout, ['stage', 'gallery', 'carousel', 'room', 'split'], base.interface.layout), theme: { primaryColor: color(theme.primaryColor, '#FAFAFA'), backgroundColor: color(theme.backgroundColor, '#09090B'), textColor: color(theme.textColor, '#FAFAFA') }, placement: choice(ui.placement, ['overlay', 'panel', 'stage'], 'panel'), controls: Array.isArray(ui.controls) ? ui.controls.slice(0, 24).map((x: unknown) => { const item = record(x); return { id: experienceId(item.id), inputBindingId: experienceId(item.inputBindingId), component: choice(item.component, ['auto', 'text', 'voice', 'upload', 'vote', 'hotspots', 'game'], 'auto'), label: text(item.label, '', 100) }; }) : inputs.map(i => ({ id: `control_${i.id}`, inputBindingId: i.id, component: 'auto', label: '' })), packageVersion: text(ui.packageVersion, '', 128), fallback: 'default', handledInputBindingIds: ui.handledInputBindingIds === undefined ? (ui.mode === 'custom' ? inputs.map(i => i.id) : []) : ids(ui.handledInputBindingIds), overlayRegion: normalizeExperienceOverlayRegion(ui.overlayRegion), ...(ui.chat !== undefined ? { chat: { presentation: choice(record(ui.chat).presentation, ['minimized', 'open', 'disabled'], 'open'), reactions: record(ui.chat).reactions !== false } } : {}) },
    rules: { resolver: choice(rules.resolver, ['narrative', 'shootout', 'tennis', 'combat', 'adventure', 'conversation'], base.rules.resolver), roundSeconds: number(rules.roundSeconds, 20, 5, 120), voteOptions: Array.isArray(rules.voteOptions) ? rules.voteOptions.filter((x: unknown) => typeof x === 'string').slice(0, 6).map((x: string) => text(x, '', 160)).filter(Boolean) : base.rules.voteOptions, tieBreak: choice(rules.tieBreak, ['first', 'seeded'], 'first'), shotsPerPlayer: number(rules.shotsPerPlayer, 5, 1, 10) },
    flow: { entryPhase: text(flow.entryPhase, 'action', 80), phases: Array.isArray(flow.phases) ? flow.phases.slice(0, 12).map((x: unknown) => { const phase = record(x); return { id: experienceId(phase.id), title: text(phase.title, '', 120), inputBindingIds: ids(phase.inputBindingIds), next: text(phase.next, 'action', 80), completion: choice(phase.completion, ['first_input', 'all_players', 'vote_deadline', 'manual'], 'first_input') }; }) : base.flow.phases.map(phase => ({ ...phase, inputBindingIds: inputs.filter(i => i.activePhases.includes(phase.id)).map(i => i.id) })) },
    scenes: Array.isArray(raw.scenes) ? raw.scenes.slice(0, 64).map((x: unknown) => { const s = record(x); return { id: experienceId(s.id), title: text(s.title, '', 120), imageUrl: experienceMediaUrl(s.imageUrl), videoUrl: experienceMediaUrl(s.videoUrl), hotspots: Array.isArray(s.hotspots) ? s.hotspots.slice(0, 16).map((x: unknown) => { const h = record(x); return { id: experienceId(h.id), label: text(h.label, '', 100), x: typeof h.x === 'number' && Number.isFinite(h.x) ? Math.max(0, Math.min(1, h.x)) : 0.5, y: typeof h.y === 'number' && Number.isFinite(h.y) ? Math.max(0, Math.min(1, h.y)) : 0.5, targetSceneId: experienceId(h.targetSceneId), action: text(h.action, '', 500) }; }) : [] }; }) : base.scenes,
    gameBindings: Array.isArray(raw.gameBindings) ? raw.gameBindings.slice(0, 6).map((x: unknown) => { const g = record(x); return { inputBindingId: experienceId(g.inputBindingId), gameId: experienceId(g.gameId), versionId: experienceId(g.versionId), placement: choice(g.placement, ['overlay', 'panel', 'stage'], 'overlay'), allowedActions: ids(g.allowedActions, 16), overlayRegion: normalizeExperienceOverlayRegion(g.overlayRegion) }; }) : [],
  };
  if (def.participation.mode === 'single') def.participation.minPlayers = def.participation.maxPlayers = 1;
  if (p.room !== undefined) { if (!['shared', 'private'].includes(p.room as string)) throw new Error('Choose shared or private rooms.'); def.participation.room = p.room as 'shared' | 'private'; }
  if (p.seats !== undefined) {
    const seats = record(p.seats);
    if (Object.keys(seats).some(key => !['version', 'slots', 'queue', 'maxSeatsPerIdentity'].includes(key))) throw new Error('Use supported seat settings.');
    if (!raw.genesis || def.participation.mode !== 'multiplayer' || !def.participation.spectators || seats.version !== 1 || !Array.isArray(seats.slots) || seats.slots.length < def.participation.minPlayers || seats.slots.length > def.participation.maxPlayers || seats.slots.some((s: any) => !s || Object.keys(s).some(key => !['id', 'label'].includes(key)) || !/^[A-Za-z0-9_-]{1,80}$/.test(s.id) || ['__proto__', 'constructor', 'prototype'].includes(s.id) || typeof s.label !== 'string' || !s.label.trim() || s.label.length > 60) || new Set(seats.slots.map((s: any) => s.id)).size !== seats.slots.length) throw new Error('Declare unique seats within the multiplayer capacity and enable spectators.');
    const max = seats.maxSeatsPerIdentity === undefined ? 1 : seats.maxSeatsPerIdentity;
    if (!Number.isInteger(max) || max < 1 || max > Math.min(8, seats.slots.length) || seats.queue !== undefined && typeof seats.queue !== 'boolean') throw new Error('Use a valid seat limit and queue setting.');
    def.participation.seats = { version: 1, slots: seats.slots.map((s: any) => ({ id: s.id, label: s.label.trim() })), queue: seats.queue === true, maxSeatsPerIdentity: max };
  }
  if (def.participation.minPlayers > def.participation.maxPlayers) throw new Error('Minimum players must fit the player capacity.');
  validateExperienceDefinition(def);
  return def;
}
export function validateExperienceDefinition(def: ExperienceDefinition): void {
  if (JSON.stringify(def).length > 128 * 1024) throw new Error('Keep the experience definition under 128 KB. Store interface code and media in their packages.');
  const inputIds = new Set(def.inputs.map(i => i.id)), phaseIds = new Set(def.flow.phases.map(p => p.id)), sceneIds = new Set(def.scenes.map(s => s.id));
  if (inputIds.size !== def.inputs.length || phaseIds.size !== def.flow.phases.length || sceneIds.size !== def.scenes.length) throw new Error('Use unique input, phase, and scene IDs.');
  if (!phaseIds.has(def.flow.entryPhase)) throw new Error('Choose an existing entry phase.');
  if (!def.genesis && def.worldVideo.enabled && def.worldVideo.pacing === 'continuous' && def.worldVideo.source !== 'generated') throw new Error('Cached and hybrid scenes use wait for input pacing.');
  for (const phase of def.flow.phases) { if (!phaseIds.has(phase.next)) throw new Error(`Phase ${phase.id} needs a valid next phase.`); for (const id of phase.inputBindingIds) if (!inputIds.has(id)) throw new Error(`Phase ${phase.id} references an unavailable input.`); }
  for (const input of def.inputs) { if (input.activePhases.some(id => !phaseIds.has(id))) throw new Error(`Input ${input.id} references an unavailable phase.`); if (input.purpose === 'character_appearance' && input.kind !== 'image') throw new Error('Character appearance requires an image input.'); }
  if (def.genesis) {
    if (def.genesis.controller === 'default' && def.worldVideo.enabled && def.worldVideo.pacing === 'continuous' && def.inputs.some(i => i.kind === 'click')) throw new Error('Scene clicks currently require Wait for input or Cached adventure so actions reference a stable frame.');
    for (const action of def.genesis.actions) if (!inputIds.has(action.inputBindingId)) throw new Error(`Action ${action.id} needs an enabled input.`);
    if (def.genesis.controller === 'default' && def.participation.mode === 'group' && !def.inputs.some(input => input.kind === 'vote')) throw new Error('Group voting needs a voting input.');
    if (def.interface.handledInputBindingIds?.some(id => !inputIds.has(id))) throw new Error('The interface references an unavailable input.');
    if (new Set(def.interface.controls.map(c => c.id)).size !== def.interface.controls.length || def.interface.controls.some(c => !inputIds.has(c.inputBindingId))) throw new Error('Use unique controls bound to enabled inputs.');
    if (def.characters.allowPhoto && !def.inputs.some(i => i.kind === 'image' && i.purpose === 'character_appearance')) throw new Error('Photo characters require an appearance image input.');
    if (new Set(def.gameBindings.map(g => g.inputBindingId)).size !== def.gameBindings.length || def.gameBindings.some(g => !g.allowedActions.length || !def.inputs.some(i => i.id === g.inputBindingId && i.kind === 'game'))) throw new Error('Pin each imported game to its own game input and allowed actions.');
    for (const scene of def.scenes) if (new Set(scene.hotspots.map(h => h.id)).size !== scene.hotspots.length || scene.hotspots.some(h => !sceneIds.has(h.targetSceneId))) throw new Error('Use unique hotspots with valid destination scenes.');
    if (def.inputs.some(i => i.lifetime === 'profile' && (i.kind !== 'image' || i.purpose !== 'character_appearance' || i.scope !== 'player'))) throw new Error('Saved profile inputs support personal character photos.');
    if (def.genesis.controller === 'default' && def.participation.mode === 'group' && def.rules.voteOptions.length < 2) throw new Error('Standard group voting needs at least two choices.');
    return;
  }
  for (const phase of def.flow.phases) {
    const bindings = def.inputs.filter(input => phase.inputBindingIds.includes(input.id));
    if (bindings.some(input => !input.activePhases.includes(phase.id))) throw new Error(`Phase ${phase.id} includes an input that is inactive in that phase.`);
    const votes = bindings.filter(input => input.kind === 'vote');
    if (votes.length && (phase.completion !== 'vote_deadline' || votes.length !== 1)) throw new Error(`Phase ${phase.id} needs one voting input and vote deadline completion.`);
    if (phase.completion === 'vote_deadline' && !votes.length) throw new Error(`Phase ${phase.id} needs a voting input.`);
    if (phase.completion !== 'manual' && bindings.filter(input => input.required && input.advanceBehavior === 'submit_readiness' && input.kind !== 'vote').length > 1) throw new Error('Use a manual phase to collect multiple required action inputs.');
    if (def.worldVideo.enabled && def.worldVideo.pacing === 'input_gated' && ['first_input', 'all_players'].includes(phase.completion) && !bindings.some(input => input.advanceBehavior === 'submit_readiness' && !['conversation', 'social_chat'].includes(input.purpose))) throw new Error(`Phase ${phase.id} needs an input that advances it.`);
  }
  if (def.inputs.some(i => i.lifetime === 'profile' && (i.kind !== 'image' || i.purpose !== 'character_appearance' || i.scope !== 'player'))) throw new Error('Saved profile inputs support personal character photos.');
  if (def.characters.allowPhoto && !def.inputs.some(i => i.kind === 'image' && i.purpose === 'character_appearance')) throw new Error('Add a character appearance image input to enable photo characters.');
  if (def.participation.mode === 'multiplayer' && ['tennis', 'combat'].includes(def.rules.resolver) && def.participation.maxPlayers !== 2) throw new Error('Tennis and combat currently support two players.');
  if (def.inputs.some(i => i.kind === 'vote') && !def.flow.phases.some(p => p.completion === 'vote_deadline' && p.inputBindingIds.some(id => def.inputs.find(i => i.id === id)?.kind === 'vote'))) throw new Error('Add a voting phase with a vote deadline.');
  if (def.interface.handledInputBindingIds?.some(id => !inputIds.has(id))) throw new Error('The custom interface references an unavailable input.');
  const controls = new Set<string>();
  const boundGames = new Set<string>();
  for (const game of def.gameBindings) { if (boundGames.has(game.inputBindingId)) throw new Error('Connect one game to each game input.'); boundGames.add(game.inputBindingId); }
  const components = { text: 'text', voice: 'voice', upload: 'image', vote: 'vote', hotspots: 'click', game: 'game' };
  for (const control of def.interface.controls) if (control.component !== 'auto' && components[control.component] !== def.inputs.find(i => i.id === control.inputBindingId)?.kind) throw new Error(`Control ${control.id} needs a component that matches its input type.`);
  for (const scene of def.scenes) if (new Set(scene.hotspots.map(h => h.id)).size !== scene.hotspots.length) throw new Error('Use unique hotspot IDs within each scene.');
  for (const control of def.interface.controls) { if (!inputIds.has(control.inputBindingId)) throw new Error(`Control ${control.id} references an unavailable input.`); if (controls.has(control.id)) throw new Error('Use unique control IDs.'); controls.add(control.id); }
  for (const input of def.inputs.filter(i => i.required)) if (!def.interface.controls.some(c => c.inputBindingId === input.id)) throw new Error(`Add a control for required input ${input.id}.`);
  for (const binding of def.gameBindings) { if (!def.inputs.some(i => i.id === binding.inputBindingId && i.kind === 'game')) throw new Error('Connect each game to a game input.'); if (!binding.allowedActions.length) throw new Error('Declare the connected game action types.'); }
  for (const scene of def.scenes) for (const hotspot of scene.hotspots) if (!sceneIds.has(hotspot.targetSceneId)) throw new Error(`Hotspot ${hotspot.id} needs an existing target scene.`);
  if (['shootout', 'tennis', 'combat'].includes(def.rules.resolver) && (def.participation.turnPolicy !== 'sequential' || def.flow.phases.some(p => p.inputBindingIds.some(id => def.inputs.find(i => i.id === id)?.kind === 'game') && p.completion !== 'first_input'))) throw new Error('Sports and combat use sequential turns with first input phase completion.');
  if (def.inputs.some(i => i.kind === 'vote') && def.rules.voteOptions.length < 2) throw new Error('Voting needs at least two options.');
  if (def.worldVideo.pacing === 'input_gated' && def.worldVideo.enabled && !def.inputs.some(i => i.advanceBehavior === 'submit_readiness')) throw new Error('A waiting world needs an input that advances it.');
}
/** Public clients receive UI configuration, not author prompts or provider credentials. */
export function publicExperienceDefinition(def: ExperienceDefinition): ExperienceDefinition { const result = JSON.parse(JSON.stringify(def)); if (result.genesis) { result.genesis.initialState = {}; delete result.genesis.worldPrompt; } return result; }

/** New worlds use a programmable harness. Older definitions remain untouched. */
export function createGenesisDefinition(): ExperienceDefinition {
  const def = createExperienceDefinition('open_world');
  def.inputs = [defaultInput('text')];
  def.characters.allowPhoto = false;
  def.interface.controls = def.inputs.map(i => ({ id: `control_${i.id}`, inputBindingId: i.id, component: 'auto', label: '' }));
  def.flow = { entryPhase: 'action', phases: [{ id: 'action', title: 'Your next action', inputBindingIds: def.inputs.map(i => i.id), next: 'action', completion: 'manual' }] };
  def.genesis = { version: 1, packageVersion: '', controller: 'default', capabilities: ['scene.request', 'image.request', 'live.direction'], actions: [], initialState: {}, limits: { maxJobs: 2, maxSessionCostUsd: 5, maxActionCostUsd: 0.5 }, playbackCompletion: 'first_player' };
  return def;
}
export function normalizeGenesisDefinition(value: unknown): GenesisDefinition {
  const raw = record(value);
  if (raw.version !== 1) throw new Error('Use Genesis package version 1.');
  const capabilities = raw.capabilities ?? ['scene.request'];
  if (!Array.isArray(capabilities) || capabilities.length > 32 || capabilities.some(x => typeof x !== 'string' || !['scene.request', 'image.request', 'live.direction'].includes(x) && !/^tool\.[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(x))) throw new Error('Declare supported Genesis tools.');
  if (raw.actions !== undefined && (!Array.isArray(raw.actions) || raw.actions.length > 32)) throw new Error('Declare up to 32 Genesis actions.');
  const actions: GenesisAction[] = (raw.actions || []).map((a: any) => {
    const fields: GenesisAction['fields'] = {};
    if (Object.keys(record(a.fields)).length > 16) throw new Error('Declare up to 16 fields per action.');
    for (const [key, value] of Object.entries(record(a.fields))) {
      const field = record(value); experienceId(key);
      fields[key] = { type: choice(field.type, ['string', 'number', 'boolean'], 'string'), required: field.required === true,
        ...(typeof field.min === 'number' && Number.isFinite(field.min) ? { min: field.min } : {}), ...(typeof field.max === 'number' && Number.isFinite(field.max) ? { max: field.max } : {}), maxLength: number(field.maxLength, 1200, 1, 4000) };
      if (fields[key].min !== undefined && fields[key].max !== undefined && fields[key].min! > fields[key].max!) throw new Error('Action field minimum must fit its maximum.');
    }
    return { id: experienceId(a.id), inputBindingId: experienceId(a.inputBindingId), label: text(a.label, a.id, 100), fields };
  });
  if (new Set(actions.map(a => a.id)).size !== actions.length) throw new Error('Use unique Genesis action IDs.');
  const initialState = record(raw.initialState);
  if (JSON.stringify(initialState).length > 16000) throw new Error('Keep initial state under 16 KB.');
  const limits = record(raw.limits);
  const cost = (value: unknown, fallback: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0.01 && value <= max ? value : value === undefined ? fallback : (() => { throw new Error(`Choose a spending limit from $0.01 to $${max}.`); })();
  return { version: 1, packageVersion: text(raw.packageVersion, '', 128), controller: choice(raw.controller, ['default', 'custom'], 'default'), capabilities: [...new Set(capabilities)] as GenesisCapability[], actions, initialState,
    ...(raw.worldPrompt !== undefined ? { worldPrompt: text(raw.worldPrompt, '', 1200) } : {}),
    ...(raw.configSchema !== undefined || raw.config !== undefined ? normalizeGenesisConfig(raw.configSchema, raw.config) : {}),
    limits: { maxJobs: number(limits.maxJobs, 2, 1, 4), maxSessionCostUsd: cost(limits.maxSessionCostUsd, 5, 1000000), maxActionCostUsd: cost(limits.maxActionCostUsd, 0.5, 1000000) }, playbackCompletion: choice(raw.playbackCompletion, ['first_player', 'all_players'], 'first_player') };
}
