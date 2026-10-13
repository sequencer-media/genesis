import type { GenesisCapability } from './experienceDefinition.js';
/** Host-owned grants. Never populate these from a creator manifest or browser request. */
export interface GenesisHostPolicy {
  capabilities: readonly GenesisCapability[]; maxPlayers: number; maxJobs: number;
  maxSessionCostUsd: number; maxActionCostUsd: number; validateAssetUrl: (url: string) => boolean;
}
export const portableAssetUrl = (url: string) => {
  if (/^\/assets\/[A-Za-z0-9_./-]+$/.test(url) && !url.includes('..')) return true;
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443'); } catch { return false; }
};
/** Conservative reference host defaults. A deployment may grant fewer capabilities. */
export const defaultGenesisHostPolicy: GenesisHostPolicy = Object.freeze({ capabilities: Object.freeze(['scene.request', 'image.request', 'live.direction'] as GenesisCapability[]), maxPlayers: 100, maxJobs: 1, maxSessionCostUsd: 5, maxActionCostUsd: .5, validateAssetUrl: portableAssetUrl });
