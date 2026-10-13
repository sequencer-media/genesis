import { Ajv2020 } from 'ajv/dist/2020.js';
import { createGenesisDefinition, experienceMediaUrl, normalizeExperienceDefinition, type ExperienceDefinition } from './experienceDefinition.js';
import { GENESIS_EXAMPLES } from './genesisExamples.js';
import { GENESIS_PROJECT_SCHEMA } from './projectSchema.js';
import { normalizeGenesisAssets, type GenesisAsset } from './assets.js';
export { GENESIS_PROJECT_SCHEMA } from './projectSchema.js';
export interface GenesisProject {
  format: 'genesis-project'; version: 1; title: string; description?: string; coverImageUrl?: string;
  definition: ExperienceDefinition; interfaceSource: string; controllerSource: string; startImageUrl: string;
  extensions?: Record<string, Record<string, unknown>>;
  assets?: GenesisAsset[];
}
export type GenesisProjectManifest = Omit<GenesisProject, 'interfaceSource' | 'controllerSource'> & {
  $schema?: string; interfaceFile: 'interface.html'; controllerFile: 'controller.js';
};
const schemaValidator = new Ajv2020({ allErrors: false, strict: false }).compile(GENESIS_PROJECT_SCHEMA);
/** Host package versions and saved-game connections have a separate lifecycle. */
export function portableGenesisDefinition(definition: ExperienceDefinition): ExperienceDefinition {
  const result = JSON.parse(JSON.stringify(definition)) as ExperienceDefinition;
  result.interface.packageVersion = '';
  if (result.genesis) result.genesis.packageVersion = '';
  result.gameBindings = [];
  return result;
}
/** Editable settings and source references. Source contents remain in their own files. */
export function createGenesisProjectManifest(project: GenesisProject): GenesisProjectManifest {
  return { $schema: './genesis.schema.json', format: project.format, version: project.version, title: project.title,
    ...(project.description ? { description: project.description } : {}), ...(project.coverImageUrl !== undefined ? { coverImageUrl: project.coverImageUrl } : {}),
    startImageUrl: project.startImageUrl, definition: portableGenesisDefinition(project.definition),
    ...(project.extensions ? { extensions: structuredClone(project.extensions) } : {}), ...(project.assets ? { assets: normalizeGenesisAssets(project.assets) } : {}), interfaceFile: 'interface.html', controllerFile: 'controller.js' };
}
/** Apply editor manifest changes while keeping the currently opened source files. */
export function applyGenesisProjectManifest(raw: unknown, interfaceSource: string, controllerSource: string): GenesisProject {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || new TextEncoder().encode(JSON.stringify(raw)).byteLength > 400000) throw new Error('Use a Genesis manifest below 400 KB.');
  const manifest = raw as GenesisProjectManifest & Partial<GenesisProject>;
  if (manifest.interfaceFile !== 'interface.html' || manifest.controllerFile !== 'controller.js') throw new Error('Reference interface.html and controller.js in this editor.');
  if (manifest.interfaceSource !== undefined || manifest.controllerSource !== undefined) throw new Error('Edit source code in interface.html and controller.js.');
  return validateGenesisProject({ ...manifest, interfaceSource, controllerSource });
}
export function validateGenesisProject(raw: unknown): GenesisProject {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || new TextEncoder().encode(JSON.stringify(raw)).byteLength > 400000) throw new Error('Use a Genesis project below 400 KB.');
  const p = raw as GenesisProject;
  if (p.format !== 'genesis-project' || p.version !== 1 || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 120) throw new Error('Use Genesis project version 1 with a title.');
  // Keep familiar semantic diagnostics for settings before schema diagnostics.
  const definition = normalizeExperienceDefinition(p.definition);
  if (!definition.genesis) throw new Error('Include a Genesis definition.');
  for (const [name, source, limit] of [['interface', p.interfaceSource, 200000], ['controller', p.controllerSource, 65536]] as const) if (typeof source !== 'string' || new TextEncoder().encode(source).byteLength > limit) throw new Error(`Keep ${name} code below ${limit} UTF-8 bytes.`);
  if (!schemaValidator(raw)) {
    const error = schemaValidator.errors![0];
    throw new Error(`Genesis JSON ${error.instancePath || '/'} ${error.message}${error.keyword === 'additionalProperties' ? `: ${(error.params as any).additionalProperty}. Keep product settings and host policies outside Genesis.` : '.'}`);
  }
  const startImageUrl = experienceMediaUrl(p.startImageUrl), coverImageUrl = p.coverImageUrl === undefined ? undefined : experienceMediaUrl(p.coverImageUrl);
  if (p.extensions && JSON.stringify(p.extensions).length > 16000) throw new Error('Keep namespaced extension data under 16 KB.');
  return { format: 'genesis-project', version: 1, title: p.title.trim(), ...(p.description ? { description: p.description } : {}),
    ...(coverImageUrl !== undefined ? { coverImageUrl } : {}), definition, interfaceSource: p.interfaceSource, controllerSource: p.controllerSource, startImageUrl,
    ...(p.extensions ? { extensions: structuredClone(p.extensions) } : {}), ...(p.assets ? { assets: normalizeGenesisAssets(p.assets) } : {}) };
}
export function createGenesisProject(exampleId = 'exploration'): GenesisProject {
  const example = GENESIS_EXAMPLES.find(e => e.id === exampleId);
  if (!example) throw new Error('Choose exploration, timing, decisions, arena or arena-llm.');
  return validateGenesisProject({ format: 'genesis-project', version: 1, title: example.label, definition: example.definition(createGenesisDefinition()), interfaceSource: example.interfaceSource, controllerSource: example.controllerSource, startImageUrl: '/assets/end.jpg' });
}
