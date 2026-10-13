import { Ajv2020 } from 'ajv/dist/2020.js';
import { createHash } from 'node:crypto';
import type { GenesisProvider, GenesisToolResult } from './adapters.js';

export const GENESIS_LLM_CAPABILITY = 'tool.llm.generate' as const;
export interface GenesisLlmRequest {
  prompt: string;
  context?: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
}
export interface GenesisLlmResultStore {
  get(id: string): Promise<GenesisToolResult | null>;
  put(id: string, result: GenesisToolResult): Promise<void>;
}
const plain = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).byteLength;
const allowed = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'minimum', 'maximum', 'enum', 'description']);
/** Deliberately bounded JSON Schema profile. No references, executable patterns or remote schemas. */
function checkSchema(schema: unknown, depth = 0, budget = { nodes: 0 }) {
  if (!plain(schema) || depth > 8 || ++budget.nodes > 128 || Object.keys(schema).some(k => !allowed.has(k))) throw new Error('Use the bounded Genesis LLM schema profile.');
  if (!['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'].includes(schema.type)) throw new Error('Declare a supported JSON type.');
  if (schema.type === 'object') {
    if (!plain(schema.properties) || Object.keys(schema.properties).length > 32 || schema.additionalProperties !== false) throw new Error('Declare bounded object properties with additionalProperties:false.');
    for (const [key, value] of Object.entries(schema.properties)) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(key) || ['constructor', 'prototype', '__proto__'].includes(key)) throw new Error('Use safe property names.');
      checkSchema(value, depth + 1, budget);
    }
    if (schema.required !== undefined && (!Array.isArray(schema.required) || new Set(schema.required).size !== schema.required.length || schema.required.some((key: unknown) => typeof key !== 'string' || !Object.hasOwn(schema.properties, key)))) throw new Error('Require declared properties.');
  }
  if (schema.type === 'array') {
    if (!Number.isInteger(schema.maxItems) || schema.maxItems < 0 || schema.maxItems > 128) throw new Error('Bound LLM arrays to 128 entries.');
    checkSchema(schema.items, depth + 1, budget);
  }
  if (schema.type === 'string' && (!Number.isInteger(schema.maxLength) || schema.maxLength < 1 || schema.maxLength > 4000)) throw new Error('Bound LLM strings to 4,000 characters.');
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length < 1 || schema.enum.length > 32 || schema.enum.some((v: unknown) => v !== null && !['string', 'number', 'boolean'].includes(typeof v)))) throw new Error('Use bounded primitive enum values.');
  if (schema.description !== undefined && (typeof schema.description !== 'string' || schema.description.length > 500)) throw new Error('Keep schema descriptions short.');
}
export function validateGenesisLlmRequest(value: unknown): GenesisLlmRequest {
  if (!plain(value) || bytes(value) > 12000 || Object.keys(value).some(k => !['prompt', 'context', 'responseSchema'].includes(k)) || typeof value.prompt !== 'string' || !value.prompt.trim() || value.prompt.length > 4000 || value.context !== undefined && !plain(value.context)) throw new Error('Send a bounded prompt, context and responseSchema.');
  checkSchema(value.responseSchema);
  if (value.responseSchema.type !== 'object') throw new Error('Use an object as the LLM response root.');
  new Ajv2020({ strict: false, allErrors: false }).compile(value.responseSchema);
  return structuredClone(value) as GenesisLlmRequest;
}
export function validateGenesisLlmResult(request: GenesisLlmRequest, raw: unknown): Record<string, unknown> {
  validateGenesisLlmRequest(request);
  if (typeof raw === 'string' && new TextEncoder().encode(raw).byteLength > 12000) throw new Error('Keep LLM results below 12 KB.');
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!plain(value) || bytes(value) > 12000 || !new Ajv2020({ strict: false, allErrors: false }).compile(request.responseSchema)(value)) throw new Error('The LLM result does not match the requested schema.');
  return structuredClone(value);
}
/** Bring any server-side LLM API. Paid adapters require a durable result store. */
export function createLlmProvider(options: {
  id?: string; paid?: boolean; results?: GenesisLlmResultStore;
  generate(request: GenesisLlmRequest, context: { idempotencyKey: string; sessionId: string; maxCostUsd: number }): Promise<unknown>;
}): GenesisProvider {
  if (options.paid && !options.results) throw new Error('Paid LLM providers need a durable result store.');
  const memory = new Map<string, GenesisToolResult>(), inFlight = new Map<string, Promise<{ id: string }>>();
  const results = options.results || { get: async (id: string) => memory.get(id) || null, put: async (id: string, value: GenesisToolResult) => { if (memory.size >= 512) memory.delete(memory.keys().next().value!); memory.set(id, value); } };
  return {
    id: options.id || 'llm', paid: options.paid || false, capabilities: [GENESIS_LLM_CAPABILITY],
    validate(job) { try { validateGenesisLlmRequest(job.effect.data); return job.effect.toolId === GENESIS_LLM_CAPABILITY; } catch { return false; } },
    async start({ job, sessionId, idempotencyKey }) {
      const id = createHash('sha256').update(idempotencyKey).digest('hex');
      if (await results.get(id)) return { id };
      if (inFlight.has(id)) return inFlight.get(id)!;
      const operation = (async () => {
        const request = validateGenesisLlmRequest(job.effect.data);
        const raw = await options.generate(request, { sessionId, idempotencyKey, maxCostUsd: job.maxCostUsd });
        await results.put(id, { data: validateGenesisLlmResult(request, raw) });
        return { id };
      })();
      inFlight.set(id, operation);
      try { return await operation; } finally { inFlight.delete(id); }
    },
    async poll(id) { const result = await results.get(id); return result ? { status: 'ready', result } : { status: 'failed', result: { error: 'The LLM result is unavailable. Reconcile the request before retrying paid generation.' } }; },
  };
}
