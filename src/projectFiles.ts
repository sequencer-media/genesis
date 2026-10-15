import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { validateGenesisProject } from './project.js';
import { validateGenesisAssetFiles } from './assets.js';
/** Source files stay separate from project settings. */
export async function loadGenesisProject(directory: string) {
  const base = await realpath(directory), manifest = await realpath(resolve(base, 'genesis.json'));
  if (!manifest.startsWith(base + sep)) throw new Error('Keep the manifest inside the project.');
  if ((await stat(manifest)).size > 400000) throw new Error('Keep the manifest below 400 KB.');
  const raw = JSON.parse(await readFile(manifest, 'utf8'));
  for (const [field, target, extension, limit] of [['interfaceFile', 'interfaceSource', '.html', 200000], ['controllerFile', 'controllerSource', '.js', 65536]] as const) {
    if (raw[field] === undefined) continue;
    if (typeof raw[field] !== 'string' || !raw[field].endsWith(extension) || raw[field].includes('..')) throw new Error(`Choose a project ${extension} file.`);
    const file = await realpath(resolve(base, raw[field]));
    if (!file.startsWith(base + sep) || (await stat(file)).size > limit) throw new Error('Source files must fit their limits and stay inside the project.');
    raw[target] = await readFile(file, 'utf8');
  }
  return validateGenesisProject(raw);
}
export async function loadGenesisProjectBundle(directory: string) {
  const base = await realpath(directory), project = await loadGenesisProject(base), assetFiles: Record<string, Uint8Array> = {};
  for (const asset of project.assets || []) {
    const file = await realpath(resolve(base, asset.path));
    if (!file.startsWith(base + sep) || (await stat(file)).size !== asset.sizeBytes) throw new Error(`Asset must stay inside the project and match its declared size: ${asset.path}.`);
    assetFiles[asset.path] = await readFile(file);
  }
  validateGenesisAssetFiles(project.assets || [], assetFiles);
  return { project, assetFiles };
}
