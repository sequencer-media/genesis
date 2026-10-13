import { createHash, randomUUID } from 'node:crypto';
import { validateGenesisProject, applyGenesisProjectManifest, createGenesisProjectManifest, type GenesisProject } from './project.js';
import { validateGenesisAssetFiles, resolveGenesisAssetUrl } from './assets.js';
import { attachGenesisAssets, detachGenesisAssets, downloadGenesisAssetFiles } from './sequencerAssets.js';
import { createLlmProvider, type GenesisLlmRequest, type GenesisLlmResultStore } from './llm.js';

/** Server-only creator client. Your host issues player credentials separately. */
export class SequencerClient {
  private readonly origin: string;
  private readonly fetcher: typeof fetch;
  private readonly uploads = new Map<string, Promise<{mediaId: string; url: string}>>();
  constructor(private readonly options: { apiKey: string; baseUrl?: string; fetch?: typeof fetch }) {
    if (typeof window !== 'undefined') throw new Error('Keep Sequencer account API keys on your server.');
    const base = new URL(options.baseUrl || 'https://api.sequencer.media/v1');
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !options.apiKey.startsWith('sk_')) throw new Error('Use a Sequencer API key and HTTPS API origin.');
    this.origin = base.href.replace(/\/$/, ''); this.fetcher = options.fetch || fetch;
  }
  async request<T = any>(path: string, body?: unknown, additionalHeaders: Record<string, string> = {}, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) throw new Error('Use an API-relative path.');
    const response = await this.fetcher(this.origin + path, { method, redirect: 'error', headers: { ...additionalHeaders, 'x-api-key': this.options.apiKey, ...(body instanceof FormData || body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error.slice(0, 320) : `Sequencer request failed (${response.status}).`);
    return result as T;
  }
  workspaces() { return this.request('/workspaces'); }
  models() { return this.request('/models'); }
  model(modelId: string) { return this.request(`/models/${encodeURIComponent(modelId)}`); }
  async media(workspaceId: string, mediaId: string) { return (await this.request(`/workspaces/${encodeURIComponent(workspaceId)}/media/${encodeURIComponent(mediaId)}`)).media; }
  generate(workspaceId: string, input: { type: 'image' | 'video' | 'audio'; model: string; prompt: string; maxCostUsd: number; idempotencyKey: string; [key: string]: unknown }) { return this.request('/generate', { ...input, workspaceId }); }
  llm(workspaceId: string, request: GenesisLlmRequest, options: { idempotencyKey: string; maxCostUsd: number }) { return this.request(`/workspaces/${encodeURIComponent(workspaceId)}/genesis/llm`, { request, ...options }); }
  async upload(workspaceId: string, path: string, mimeType: string, bytes: Uint8Array): Promise<{ mediaId: string; url: string }> {
    const key = createHash('sha256').update(workspaceId).update(mimeType).update(bytes).digest('hex');
    let pending = this.uploads.get(key);
    if (!pending) {
      const form = new FormData(); form.set('workspaceId', workspaceId); form.set('context', 'genesis'); form.set('file', new Blob([new Uint8Array(bytes)], {type: mimeType}), path.split('/').pop()!);
      pending = this.request<{mediaId: string; url: string}>('/upload', form); this.uploads.set(key, pending);
      pending.catch(() => this.uploads.delete(key));
      if (this.uploads.size > 256) this.uploads.delete(this.uploads.keys().next().value!);
    }
    return pending;
  }
  /** Save a draft and its immutable media copies. Publication remains an explicit host operation. */
  async save(workspaceId: string, projectInput: GenesisProject, options: { liveWorldId?: string; expectedVersionId?: string; assetFiles?: Record<string, Uint8Array>; settings?: Record<string, unknown> } = {}) {
    const attached = await attachGenesisAssets(projectInput, options.assetFiles || {}, (path, mime, bytes) => this.upload(workspaceId, path, mime, bytes));
    const {project: hosted, interfaceAssets} = attached, interfaceSource = hosted.interfaceSource;
    return this.request(`/workspaces/${encodeURIComponent(workspaceId)}/world-experiences`, { project: createGenesisProjectManifest(hosted), interfaceSource, controllerSource: hosted.controllerSource, interfaceAssets, expectedVersionId: options.expectedVersionId || '', ...(options.liveWorldId ? { liveWorldId: options.liveWorldId } : {}), ...(options.settings ? { settings: options.settings } : {}) });
  }
  async load(workspaceId: string, worldId: string) {
    const record = await this.request(`/workspaces/${encodeURIComponent(workspaceId)}/live-worlds/${encodeURIComponent(worldId)}/experience`);
    const hosted = applyGenesisProjectManifest(record.project, record.interfaceSource, record.controllerSource);
    return {project: await detachGenesisAssets(hosted), assetFiles: await downloadGenesisAssetFiles(hosted, record.interfaceAssetSources || {}, this.fetcher), versionId: record.versionId};
  }
  preview(workspaceId: string, liveWorldId: string) { return this.request(`/workspaces/${encodeURIComponent(workspaceId)}/live-worlds/${encodeURIComponent(liveWorldId)}/experience/preview`, {}); }
  readSession(sessionId: string, playerToken: string) { return this.request(`/public/world-experience-sessions/${encodeURIComponent(sessionId)}`, undefined, { 'x-session-token': playerToken }); }
  action(sessionId: string, playerToken: string, actionId: string, data: Record<string, unknown>, expectedRevision: number, eventId = randomUUID()) { return this.request(`/public/world-experience-sessions/${encodeURIComponent(sessionId)}/actions`, { eventId, actionId, payload: data, expectedRevision }, { 'x-session-token': playerToken }); }
  runJob(sessionId: string, playerToken: string, workspaceId: string, jobId: string) { return this.request(`/world-experience-sessions/${encodeURIComponent(sessionId)}/genesis/jobs/${encodeURIComponent(jobId)}/run`, { workspaceId }, { 'x-session-token': playerToken }); }
  players(sessionId: string, playerToken: string, request: import('./participation.js').GenesisPlayerRequest) { return this.request(`/public/world-experience-sessions/${encodeURIComponent(sessionId)}/players`, request, { 'x-session-token': playerToken }); }
  playback(sessionId: string, playerToken: string, playbackId: string) { return this.request(`/public/world-experience-sessions/${encodeURIComponent(sessionId)}/playback`, { outputId: playbackId }, { 'x-session-token': playerToken }); }
  streamQuote(workspaceId: string, worldId: string, maxSessionSeconds = 600) { return this.request(`/workspaces/${encodeURIComponent(workspaceId)}/live-worlds/${encodeURIComponent(worldId)}/streams/quote?maxSessionSeconds=${encodeURIComponent(maxSessionSeconds)}`); }
  startStream(workspaceId: string, worldId: string, sessionId: string, maxSessionSeconds = 600) { return this.request(`/workspaces/${encodeURIComponent(workspaceId)}/live-worlds/${encodeURIComponent(worldId)}/streams/${encodeURIComponent(sessionId)}/start`, {maxSessionSeconds}); }
  readStream(workspaceId: string, worldId: string, sessionId: string, playbackSequence?: number) { return this.request(`/workspaces/${encodeURIComponent(workspaceId)}/live-worlds/${encodeURIComponent(worldId)}/streams/${encodeURIComponent(sessionId)}/heartbeat`, playbackSequence === undefined ? {} : {playbackSequence}); }
  directStream(workspaceId: string, worldId: string, sessionId: string, prompt: string) { return this.request(`/workspaces/${encodeURIComponent(workspaceId)}/live-worlds/${encodeURIComponent(worldId)}/streams/${encodeURIComponent(sessionId)}/prompt`, { prompt }); }
  stopStream(workspaceId: string, worldId: string, sessionId: string) { return this.request(`/workspaces/${encodeURIComponent(workspaceId)}/live-worlds/${encodeURIComponent(worldId)}/streams/${encodeURIComponent(sessionId)}/stop`, {}); }
}
export function createSequencerLlmProvider(options: { client: SequencerClient; workspaceId: string; results: GenesisLlmResultStore }) {
  return createLlmProvider({ id: 'sequencer-llm', paid: true, results: options.results, generate: async (request, context) => {
    const result = await options.client.llm(options.workspaceId, request, { idempotencyKey: context.idempotencyKey, maxCostUsd: context.maxCostUsd });
    return result.data;
  } });
}
