import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(resolve(root, 'node_modules/typescript/lib/lib.dom.d.ts')) || !existsSync(resolve(root, 'node_modules/quickjs-emscripten/package.json'))) execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
