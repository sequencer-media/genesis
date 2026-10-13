import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { applyGenesisProjectManifest, createGenesisProjectManifest, validateGenesisProject, type GenesisProject } from './project.js';
import { GENESIS_PROJECT_SCHEMA } from './projectSchema.js';
import { GENESIS_ASSET_LIMITS, genesisAssetPath, validateGenesisAssetFiles } from './assets.js';
/** Bundles contain source, schema and explicitly declared media. Remote references stay remote. */
export function exportGenesisProjectArchive(project: GenesisProject, assetFiles: Record<string, Uint8Array> = {}): Uint8Array {
  if (project.definition.gameBindings.length) throw new Error('Move connected game code into the Genesis interface and controller before exporting a standalone project.');
  const manifest = createGenesisProjectManifest(project);
  applyGenesisProjectManifest(manifest, project.interfaceSource, project.controllerSource);
  validateGenesisAssetFiles(project.assets || [], assetFiles);
  return zipSync({
    'genesis.json': strToU8(JSON.stringify(manifest, null, 2) + '\n'),
    'interface.html': strToU8(project.interfaceSource), 'controller.js': strToU8(project.controllerSource),
    'genesis.schema.json': strToU8(JSON.stringify(GENESIS_PROJECT_SCHEMA, null, 2) + '\n'),
    ...assetFiles,
  });
}
export function importGenesisProjectBundle(bytes: Uint8Array): { project: GenesisProject; assetFiles: Record<string, Uint8Array> } {
  if (bytes.length > GENESIS_ASSET_LIMITS.totalBytes + 1024 * 1024) throw new Error('Use a Genesis project archive below 101 MB.');
  const limits: Record<string, number> = { 'genesis.json': 400000, 'interface.html': 200000, 'controller.js': 65536 };
  let total = 0, assetTotal = 0, count = 0; const seen = new Set<string>();
  const files = unzipSync(bytes, { filter: file => {
    if (file.name.startsWith('assets/')) {
      genesisAssetPath(file.name);
      if (seen.has(file.name) || ++count > GENESIS_ASSET_LIMITS.count || file.originalSize > GENESIS_ASSET_LIMITS.fileBytes || (assetTotal += file.originalSize) > GENESIS_ASSET_LIMITS.totalBytes) throw new Error('Bundled assets exceed their limits or contain duplicate paths.');
      seen.add(file.name); return true;
    }
    if (!Object.hasOwn(limits, file.name)) {
      if (file.name !== 'genesis.schema.json') throw new Error('Include only project sources, schema and declared media assets.');
      return false;
    }
    if (seen.has(file.name)) throw new Error('Duplicate project source.'); seen.add(file.name);
    if (file.originalSize > limits[file.name] || (total += file.originalSize) > 665536) throw new Error('Project files exceed their source limits.');
    return true;
  } });
  if (Object.keys(limits).some(name => !files[name])) throw new Error('Include genesis.json, interface.html and controller.js at the root of the archive.');
  const project = applyGenesisProjectManifest(JSON.parse(strFromU8(files['genesis.json'])), strFromU8(files['interface.html']), strFromU8(files['controller.js']));
  const assetFiles = Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith('assets/')));
  validateGenesisAssetFiles(project.assets || [], assetFiles);
  return { project, assetFiles };
}
export function importGenesisProjectArchive(bytes: Uint8Array): GenesisProject { return importGenesisProjectBundle(bytes).project; }
/** Single-file transport imports remain supported alongside three-file archives. */
export function importGenesisProjectText(text: string): GenesisProject {
  if (text.length > 400000) throw new Error('Use a project below 400 KB.');
  return validateGenesisProject(JSON.parse(text));
}
