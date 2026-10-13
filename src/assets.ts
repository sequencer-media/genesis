/** Portable media paths are project-relative. A host resolves them to its own storage. */
export interface GenesisAsset { path: string; mimeType: string; sizeBytes: number }
export const GENESIS_ASSET_LIMITS = Object.freeze({ count: 64, fileBytes: 50 * 1024 * 1024, totalBytes: 100 * 1024 * 1024 });
const types: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };
export function genesisAssetPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 240 || !/^assets\/[A-Za-z0-9_/-]+\.[a-z0-9]+$/.test(value) || value.split('/').some(p => !p || p === '.' || p === '..') || !types[value.split('.').pop()!]) throw new Error('Use a project-relative media path inside assets/.');
  return value;
}
export function normalizeGenesisAssets(raw: unknown): GenesisAsset[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > GENESIS_ASSET_LIMITS.count) throw new Error('Use up to 64 portable media assets.');
  const seen = new Set<string>(); let total = 0;
  return raw.map(asset => {
    const path = genesisAssetPath(asset?.path);
    if (seen.has(path) || asset.mimeType !== types[path.split('.').pop()!] || !Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes <= 0 || asset.sizeBytes > GENESIS_ASSET_LIMITS.fileBytes || Object.keys(asset).some(k => !['path', 'mimeType', 'sizeBytes'].includes(k))) throw new Error('Declare unique assets with their MIME type and bounded byte size.');
    seen.add(path); total += asset.sizeBytes;
    if (total > GENESIS_ASSET_LIMITS.totalBytes) throw new Error('Keep portable assets below 100 MB total.');
    return { path, mimeType: asset.mimeType as string, sizeBytes: asset.sizeBytes as number };
  });
}
export function validateGenesisAssetFiles(assets: GenesisAsset[], files: Record<string, Uint8Array>) {
  normalizeGenesisAssets(assets);
  if (Object.keys(files).some(path => !assets.some(a => a.path === path))) throw new Error('Every bundled file must be declared in assets.');
  for (const asset of assets) if (!(files[asset.path] instanceof Uint8Array) || files[asset.path].length !== asset.sizeBytes) throw new Error(`Include the complete asset: ${asset.path}.`);
}
/** Exact references only. Generated text and executable source are not rewritten. */
export function resolveGenesisAssetUrl(url: string, sources: Record<string, string>): string {
  const path = url.startsWith('/assets/') ? url.slice(1) : url.startsWith('assets/') ? url : '';
  if (!path) return url;
  genesisAssetPath(path);
  const target = sources[path];
  if (!target) throw new Error(`Resolve the portable asset before hosting: ${path}.`);
  const parsed = new URL(target);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port && parsed.port !== '443') throw new Error('Hosted media assets require HTTPS URLs.');
  return target;
}
