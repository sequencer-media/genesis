import { validateGenesisProject, type GenesisProject } from './project.js';
import { validateGenesisAssetFiles, resolveGenesisAssetUrl } from './assets.js';
const KEY = 'genesis.portable-media';
export async function sequencerAssetId(path: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path));
  return 'g_' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
/** Works in browsers and servers; the caller owns credentials and upload authorization. */
export async function attachGenesisAssets(input: GenesisProject, files: Record<string, Uint8Array>, upload: (path: string, mimeType: string, bytes: Uint8Array) => Promise<{mediaId: string; url: string}>) {
  const project = validateGenesisProject(input); validateGenesisAssetFiles(project.assets || [], files);
  if ((project.assets?.length || 0) > 40 || project.assets?.some(asset => asset.sizeBytes > 20 * 1024 * 1024)) throw new Error('Sequencer supports 40 media assets, each below 20 MB.');
  const urls: Record<string, string> = {}, sources: Record<string, string> = {}, interfaceAssets: Array<{id: string; mediaId: string; portablePath: string}> = [];
  let interfaceSource = project.interfaceSource;
  for (const asset of project.assets || []) {
    const uploaded = await upload(asset.path, asset.mimeType, files[asset.path]), id = await sequencerAssetId(asset.path);
    urls[asset.path] = uploaded.url; sources[id] = uploaded.url; interfaceAssets.push({id, mediaId: uploaded.mediaId, portablePath: asset.path});
    const escaped = asset.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    interfaceSource = interfaceSource.replace(new RegExp(`(^|["'(=\\s])/?${escaped}(?=["')\\s<>;]|$)`, 'g'), (_, prefix) => `${prefix}asset://${id}`);
  }
  const definition = structuredClone(project.definition);
  for (const scene of definition.scenes) {scene.imageUrl = resolveGenesisAssetUrl(scene.imageUrl, urls); scene.videoUrl = resolveGenesisAssetUrl(scene.videoUrl, urls);}
  const references = {startImageUrl: project.startImageUrl, coverImageUrl: project.coverImageUrl || '', scenes: project.definition.scenes.map(s => ({id: s.id, imageUrl: s.imageUrl, videoUrl: s.videoUrl}))};
  const hosted = validateGenesisProject({...project, definition, interfaceSource, startImageUrl: resolveGenesisAssetUrl(project.startImageUrl, urls), coverImageUrl: resolveGenesisAssetUrl(project.coverImageUrl || '', urls), extensions: {...project.extensions, ...(project.assets?.length ? {[KEY]: {version: 1, references}} : {})}});
  return {project: hosted, interfaceAssets, sources};
}
export async function detachGenesisAssets(input: GenesisProject) {
  const project = structuredClone(input), data = project.extensions?.[KEY] as any;
  if (data?.version !== 1 || !data.references) return validateGenesisProject(project);
  const allowed = new Set((project.assets || []).map(a => a.path));
  const local = (value: unknown) => typeof value === 'string' && allowed.has(value.replace(/^[/]/, '')) ? value : null;
  project.startImageUrl = local(data.references.startImageUrl) || project.startImageUrl;
  project.coverImageUrl = local(data.references.coverImageUrl) || project.coverImageUrl;
  for (const scene of project.definition.scenes) {const original = data.references.scenes?.find((s: any) => s.id === scene.id); scene.imageUrl = local(original?.imageUrl) || scene.imageUrl; scene.videoUrl = local(original?.videoUrl) || scene.videoUrl;}
  for (const asset of project.assets || []) project.interfaceSource = project.interfaceSource.split(`asset://${await sequencerAssetId(asset.path)}`).join(asset.path);
  delete project.extensions![KEY]; return validateGenesisProject(project);
}
export async function downloadGenesisAssetFiles(project: GenesisProject, sources: Record<string, string>, fetcher: typeof fetch = fetch) {
  const files: Record<string, Uint8Array> = {};
  for (const asset of project.assets || []) {
    const url = sources[await sequencerAssetId(asset.path)];
    if (!url || new URL(url).protocol !== 'https:') throw new Error(`Refresh the world to download its asset: ${asset.path}`);
    const response = await fetcher(url, {redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(30000)});
    if (!response.ok || Number(response.headers.get('content-length') || asset.sizeBytes) !== asset.sizeBytes) throw new Error(`Asset download failed: ${asset.path}`);
    const reader = response.body?.getReader(); if (!reader) throw new Error('Asset download is unavailable.');
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > asset.sizeBytes) {await reader.cancel(); throw new Error('Asset download exceeded its declared size.');} chunks.push(value);}
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;} files[asset.path] = bytes;
  }
  validateGenesisAssetFiles(project.assets || [], files); return files;
}
