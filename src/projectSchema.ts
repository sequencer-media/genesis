/** Versioned, provider-independent JSON Schema for manifests and inline transport projects. */
const string = (maxLength = 128) => ({ type: 'string', maxLength });
const enumeration = (...values: string[]) => ({ type: 'string', enum: values });
const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });
const number = (minimum: number, maximum: number) => ({ type: 'number', minimum, maximum });
const boolean = { type: 'boolean' };
const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const array = (items: unknown, maxItems: number) => ({ type: 'array', items, maxItems });
const id = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$' };
const ids = array(id, 16);
const region = object({ x: number(0, 1), y: number(0, 1), width: { type: 'number', exclusiveMinimum: 0, maximum: 1 }, height: { type: 'number', exclusiveMinimum: 0, maximum: 1 } }, ['x', 'y', 'width', 'height']);
const field = object({ type: enumeration('string', 'number', 'boolean'), required: boolean, min: { type: 'number' }, max: { type: 'number' }, maxLength: integer(1, 4000) }, ['type']);
const configField = object({ type: enumeration('string', 'number', 'boolean'), label: string(100), description: string(240), default: { type: ['string', 'number', 'boolean'] }, min: { type: 'number' }, max: { type: 'number' }, maxLength: integer(1, 4000), options: array(object({ value: { type: ['string', 'number'] }, label: string(100) }, ['value', 'label']), 24) }, ['type', 'label', 'default']);
const contentPolicy = object({ violence: enumeration('none', 'mild', 'moderate'), nudity: enumeration('none', 'non_explicit'), sexualThemes: enumeration('none', 'mild'), language: enumeration('none', 'mild', 'strong'), substances: enumeration('none', 'mild'), frighteningContent: enumeration('none', 'mild', 'intense') });
export const GENESIS_PROJECT_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'urn:genesis:project:1', title: 'Genesis project version 1',
  ...object({
    $schema: string(4096), format: { const: 'genesis-project' }, version: { const: 1 }, title: { ...string(120), minLength: 1 }, description: string(4000),
    coverImageUrl: string(4096), startImageUrl: string(4096),
    assets: array(object({ path: { type: 'string', maxLength: 240, pattern: '^assets/[A-Za-z0-9_/-]+\\.[a-z0-9]+$' }, mimeType: enumeration('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg'), sizeBytes: integer(1, 52428800) }, ['path', 'mimeType', 'sizeBytes']), 64),
    interfaceFile: { type: 'string', pattern: '^(?!/)(?!.*\\.\\.)[A-Za-z0-9_./-]+\\.html$' },
    controllerFile: { type: 'string', pattern: '^(?!/)(?!.*\\.\\.)[A-Za-z0-9_./-]+\\.js$' },
    interfaceSource: string(200000), controllerSource: string(65536),
    extensions: { type: 'object', maxProperties: 16, propertyNames: { pattern: '^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)+$' }, additionalProperties: { type: 'object' } },
    definition: object({
      schemaVersion: { const: 2 }, presetId: string(128), contentPolicy,
      participation: object({ mode: enumeration('single', 'multiplayer', 'group'), minPlayers: integer(1, 100), maxPlayers: integer(1, 100), spectators: boolean, turnPolicy: enumeration('sequential', 'simultaneous', 'first_input'), joinPolicy: enumeration('lobby', 'round_boundary', 'drop_in'), room: enumeration('shared', 'private'), seats: object({ version: { const: 1 }, slots: { ...array(object({ id: { ...id, maxLength: 80 }, label: { ...string(60), minLength: 1 } }, ['id', 'label']), 100), minItems: 1 }, queue: boolean, maxSeatsPerIdentity: integer(1, 8) }, ['version', 'slots']) }),
      worldVideo: object({ enabled: boolean, pacing: enumeration('continuous', 'input_gated'), source: enumeration('generated', 'cached', 'hybrid'), idlePresentation: enumeration('hold_frame', 'image', 'loop'), continuity: enumeration('continue_scene', 'reset_turn'), modelId: string(128), maxCostUsd: number(.01, 5), chunkIntervalSeconds: integer(2, 30) }),
      inputs: array(object({ id, kind: enumeration('text', 'vote', 'voice', 'image', 'click', 'game'), purpose: enumeration('world_action', 'conversation', 'social_chat', 'character_appearance', 'scene_reference', 'vote', 'navigation', 'game_command', 'player_instruction'), scope: enumeration('player', 'world', 'conversation'), lifetime: enumeration('one_action', 'phase', 'session', 'until_replaced', 'profile'), activePhases: ids, required: boolean, maxLength: integer(1, 4000), advanceBehavior: enumeration('context_only', 'submit_readiness') }, ['id', 'kind']), 16),
      characters: object({ selectionEnabled: boolean, display: enumeration('grid', 'carousel', 'room'), allowPhoto: boolean, appearanceLifetime: enumeration('session', 'profile'), conversationHistory: enumeration('session', 'persistent') }),
      interface: object({ stageAspectRatio: { ...number(.25, 4), default: 16 / 9, description: 'Media stage width divided by height. 1.7777777777777777 is 16:9; 0.5625 is 9:16; 1 is square. Media is contained within this shape.' }, mode: enumeration('default', 'composed', 'custom'), layout: enumeration('stage', 'gallery', 'carousel', 'room', 'split'), theme: object({ primaryColor: string(7), backgroundColor: string(7), textColor: string(7) }), placement: enumeration('overlay', 'panel', 'stage'), controls: array(object({ id, inputBindingId: id, component: enumeration('auto', 'text', 'voice', 'upload', 'vote', 'hotspots', 'game'), label: string(100) }, ['id', 'inputBindingId']), 24), packageVersion: { const: '' }, fallback: { const: 'default' }, handledInputBindingIds: ids, overlayRegion: region,
        chat: object({ presentation: enumeration('minimized', 'open', 'disabled'), reactions: boolean }, ['presentation', 'reactions']) }),
      genesis: object({ version: { const: 1 }, packageVersion: { const: '' }, controller: enumeration('default', 'custom'), capabilities: array({ type: 'string', pattern: '^(scene\\.request|image\\.request|live\\.direction|tool\\.[A-Za-z][A-Za-z0-9_.-]{0,79})$' }, 32), actions: array(object({ id, inputBindingId: id, label: string(100), fields: { type: 'object', maxProperties: 16, additionalProperties: field } }, ['id', 'inputBindingId']), 32), initialState: { type: 'object' }, worldPrompt: string(1200), configSchema: { type: 'object', maxProperties: 32, additionalProperties: configField }, config: { type: 'object', maxProperties: 32, additionalProperties: { type: ['string', 'number', 'boolean'] } }, limits: object({ maxJobs: integer(1, 4), maxSessionCostUsd: number(.01, 1000000), maxActionCostUsd: number(.01, 1000000) }), playbackCompletion: enumeration('first_player', 'all_players') }, ['version']),
      rules: object({ resolver: enumeration('narrative', 'shootout', 'tennis', 'combat', 'adventure', 'conversation'), roundSeconds: integer(5, 120), voteOptions: array(string(160), 6), tieBreak: enumeration('first', 'seeded'), shotsPerPlayer: integer(1, 10) }),
      flow: object({ entryPhase: id, phases: array(object({ id, title: string(120), inputBindingIds: ids, next: id, completion: enumeration('first_input', 'all_players', 'vote_deadline', 'manual') }, ['id', 'next']), 12) }),
      scenes: array(object({ id, title: string(120), imageUrl: string(4096), videoUrl: string(4096), hotspots: array(object({ id, label: string(100), x: number(0, 1), y: number(0, 1), targetSceneId: id, action: string(500) }, ['id', 'targetSceneId']), 16) }, ['id']), 64),
      gameBindings: { type: 'array', maxItems: 0, description: 'Saved game IDs are host connections. Implement portable game behavior in the interface and controller.' },
    }, ['schemaVersion', 'genesis']),
  }, ['format', 'version', 'title', 'definition', 'startImageUrl']),
  anyOf: [{ required: ['interfaceFile', 'controllerFile'] }, { required: ['interfaceSource', 'controllerSource'] }],
} as const;
