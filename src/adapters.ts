import type {GenesisStreamChunk} from './queue.js';
import type { GenesisAnchor, GenesisJob } from './genesisCore.js';
import type { GenesisCapability } from './experienceDefinition.js';
import type { ExperienceSessionState } from './experienceSessionCore.js';
export interface GenesisToolResult { imageUrl?: string; videoUrl?: string; mediaId?: string; error?: string; data?: Record<string, unknown>; }
export class GenesisProviderSubmissionError extends Error { constructor(message: string, readonly ambiguous: boolean) { super(message); } }
export interface GenesisProvider {
  id: string; paid: boolean; capabilities: readonly GenesisCapability[];
  start(request: { sessionId: string; job: GenesisJob; anchor?: GenesisAnchor; referenceAnchors?: GenesisAnchor[]; idempotencyKey: string }): Promise<{ id: string }>;
  poll(id: string, job: GenesisJob): Promise<{ status: 'running' | 'ready' | 'failed'; result?: GenesisToolResult }>;
  validate?(job: GenesisJob): Promise<boolean> | boolean;
  /** A paid provider explicitly confirms a refund before the spend reservation is released. */
  cancel?(id: string): Promise<void | { refunded?: boolean }>;
}
export interface GenesisSnapshot { version: 1; projectHash: string; state: ExperienceSessionState; providerJobs: Record<string, { providerId: string; id: string }>; timeline: GenesisTrace[]; }
export interface GenesisTrace { at: number; type: string; eventId: string; revision: number; detail?: string; }
export interface GenesisStorage { load(sessionId: string): Promise<GenesisSnapshot | null>; save(sessionId: string, snapshot: GenesisSnapshot): Promise<void>; }
export interface GenesisToolAuthorization { sessionId: string; actorId: string; job: GenesisJob; provider: GenesisProvider; }
/** A host may attach authoritative identity, moderation, billing and verified commerce here. */
export interface GenesisHostServices {
  streamQueue?: () => GenesisStreamChunk[];
  authorizeTool?: (request: GenesisToolAuthorization) => Promise<boolean>;
  moderateAction?: (request: { actorId: string; actionId: string; payload: unknown }) => Promise<boolean>;
}
export class MemoryGenesisStorage implements GenesisStorage {
  private records = new Map<string, GenesisSnapshot>();
  async load(id: string) { return structuredClone(this.records.get(id) || null); }
  async save(id: string, snapshot: GenesisSnapshot) { this.records.set(id, structuredClone(snapshot)); }
}
