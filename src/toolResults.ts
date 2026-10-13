import { mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GenesisLlmResultStore } from './llm.js';
import type { GenesisToolResult } from './adapters.js';
/** Durable single-host results. Production multi-worker hosts supply a transactional store. */
export class FileGenesisToolResults implements GenesisLlmResultStore {
  constructor(private readonly directory: string) {}
  private path(id: string) { if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Use a hashed tool result ID.'); return resolve(this.directory, `${id}.json`); }
  async get(id: string) {
    const path = this.path(id);
    try { if ((await stat(path)).size > 16000) throw new Error('Tool result exceeds 16 KB.'); return JSON.parse(await readFile(path, 'utf8')) as GenesisToolResult; }
    catch (error: any) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async put(id: string, result: GenesisToolResult) {
    const path = this.path(id), text = JSON.stringify(result); if (Buffer.byteLength(text) > 16000) throw new Error('Tool result exceeds 16 KB.');
    await mkdir(this.directory, { recursive: true }); const temporary = path + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, text, { mode: 0o600, flag: 'wx' }); await rename(temporary, path);
  }
}
