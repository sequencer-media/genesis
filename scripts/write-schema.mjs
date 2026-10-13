import { mkdir, writeFile } from 'node:fs/promises';
import { GENESIS_PROJECT_SCHEMA } from '../dist/projectSchema.js';
await mkdir(new URL('../schema/', import.meta.url), { recursive: true });
await writeFile(new URL('../schema/genesis.schema.json', import.meta.url), JSON.stringify(GENESIS_PROJECT_SCHEMA, null, 2) + '\n');
