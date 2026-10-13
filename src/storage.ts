import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GenesisStorage, GenesisSnapshot } from './adapters.js';
/** Atomic single-process reference storage. Multi-worker hosts should implement database transactions. */
export class FileGenesisStorage implements GenesisStorage {
  constructor(private directory: string) {}
  private path(id: string) { if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error('Use a safe session ID.'); return join(this.directory, `${id}.json`); }
  async load(id: string) { try { return JSON.parse(await readFile(this.path(id), 'utf8')) as GenesisSnapshot; } catch (error: any) { if (error.code === 'ENOENT') return null; throw error; } }
  async save(id: string, snapshot: GenesisSnapshot) { await mkdir(this.directory, { recursive: true }); const destination = this.path(id), temporary = `${destination}.${randomUUID()}.tmp`; await writeFile(temporary, JSON.stringify(snapshot), { mode: 0o600 }); await rename(temporary, destination); }
}
