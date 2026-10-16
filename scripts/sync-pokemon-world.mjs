import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Supply the authored Pokémon Wildclash project directory.');
const source = resolve(process.argv[2]), destination = resolve(root, 'examples/pokemon-wildclash');
const manifest = JSON.parse(await readFile(resolve(source, 'genesis.json'), 'utf8'));
if (manifest.format !== 'genesis-project' || manifest.title !== 'Pokémon Wildclash') throw new Error('Choose the Pokémon Wildclash Genesis project.');
await mkdir(resolve(destination, 'assets'), { recursive: true });
for (const name of ['controller.js', 'interface.html', 'BATTLE.md', 'battle.test.mjs', 'trainer-flow.test.mjs', 'announcements.test.mjs', 'latency.test.mjs', 'frame-library.test.mjs']) {
  const text = await readFile(resolve(source, name), 'utf8');
  await writeFile(resolve(destination, name), name.endsWith('.test.mjs') ? text.replaceAll('../../packages/genesis/dist/', '../../dist/') : text);
}
const image = await readFile(resolve(source, 'assets/realistic-kanto-start.png'));
await writeFile(resolve(destination, 'assets/start.png'), image);
manifest.coverImageUrl = '/assets/start.png';
manifest.startImageUrl = '/assets/start.png';
manifest.assets = [{ path: 'assets/start.png', mimeType: 'image/png', sizeBytes: image.length }];
await writeFile(resolve(destination, 'genesis.json'), JSON.stringify(manifest, null, 2) + '\n');
await copyFile(resolve(root, 'schema/genesis.schema.json'), resolve(destination, 'genesis.schema.json'));
console.log('Updated the portable Pokémon Wildclash project. Run npm test to verify runtime compatibility.');
