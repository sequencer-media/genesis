import { GenesisProviderSubmissionError, type GenesisProvider, type GenesisToolResult } from './adapters.js';
import type { GenesisJob, GenesisAnchor } from './genesisCore.js';
interface Prediction { id: string; status: string; output?: unknown; error?: unknown; }
export interface ReplicateModel {
  version: string; maxEstimatedCostUsd: number;
  input: (job: GenesisJob, anchor?: GenesisAnchor) => Record<string, unknown>;
  /** Persist outputs and extract the actual end frame for video before returning ready. */
  result: (output: unknown, job: GenesisJob) => Promise<GenesisToolResult>;
}
/** Server-only adapter. Registered models and credentials come from the host. */
export function createReplicateProvider(options: { token: string; models: Partial<Record<'scene.request' | 'image.request', ReplicateModel>>; fetch?: typeof fetch }): GenesisProvider {
  if (!options.token) throw new Error('The host must provide a Replicate token.');
  const request = options.fetch || fetch, submitted = new Map<string, Promise<{ id: string }>>();
  const api = async (path: string, init?: RequestInit): Promise<Prediction> => {
    const response = await request(`https://api.replicate.com/v1/${path}`, { ...init, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' } });
    if (!response.ok) throw new GenesisProviderSubmissionError(`Replicate request failed (${response.status}).`, response.status >= 500);
    const data = await response.json() as Prediction;
    if (!data || typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.id)) throw new Error('Replicate returned an invalid prediction.');
    return data;
  };
  return { id: 'replicate', paid: true, capabilities: Object.keys(options.models) as Array<'scene.request' | 'image.request'>,
    async start({ job, anchor, idempotencyKey }) {
      if (submitted.has(idempotencyKey)) return submitted.get(idempotencyKey)!;
      const model = options.models[job.effect.type as 'scene.request' | 'image.request'];
      if (!model || !/^[a-f0-9]{64}$/.test(model.version) || !Number.isFinite(model.maxEstimatedCostUsd) || model.maxEstimatedCostUsd <= 0 || model.maxEstimatedCostUsd > job.maxCostUsd) throw new Error('Register a pinned model and a cost estimate within the host limit.');
      const operation = api('predictions', { method: 'POST', body: JSON.stringify({ version: model.version, input: model.input(job, anchor) }) }).then(p => ({ id: p.id }));
      submitted.set(idempotencyKey, operation); return operation;
    },
    async poll(id, job) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Use a valid prediction ID.');
      const prediction = await api(`predictions/${id}`);
      if (['failed', 'canceled'].includes(prediction.status)) return { status: 'failed', result: { error: 'The model could not complete this prediction.' } };
      if (prediction.status !== 'succeeded') return { status: 'running' };
      const model = options.models[job.effect.type as 'scene.request' | 'image.request']!;
      const result = await model.result(prediction.output, job);
      if (!result.imageUrl || job.effect.type === 'scene.request' && !result.videoUrl) throw new Error('Persist the media and its actual final frame before completing the prediction.');
      return { status: 'ready', result: { ...result, mediaId: id } };
    },
    async cancel(id) { if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Use a valid prediction ID.'); await api(`predictions/${id}/cancel`, { method: 'POST' }); },
  };
}
