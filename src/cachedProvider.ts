import type { GenesisProvider, GenesisToolResult } from './adapters.js';
/** Prepared results exercise the real job and playback lifecycle without external requests. */
export function createCachedProvider(results: GenesisToolResult[]): GenesisProvider {
  if (!results.length) throw new Error('Provide at least one cached result.');
  return { id: 'cached', paid: false, capabilities: ['scene.request', 'image.request'],
    async start({ idempotencyKey, job }) { return { id: JSON.stringify({ key: idempotencyKey, type: job.effect.type, index: job.sourceRevision % results.length }) }; },
    async poll(id) { const data = JSON.parse(id); const result = results[data.index % results.length]; return { status: 'ready', result: data.type === 'image.request' ? { imageUrl: result.imageUrl } : result }; },
  };
}
