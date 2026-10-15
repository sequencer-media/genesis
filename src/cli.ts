#!/usr/bin/env node
import { cp, mkdir, writeFile, readFile, readdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENESIS_PROJECT_SCHEMA, createGenesisProject, createGenesisProjectManifest } from './project.js';
import { loadGenesisProject, loadGenesisProjectBundle } from './projectFiles.js';
import { SequencerClient } from './sequencer.js';
import { exportGenesisProjectArchive } from './projectArchive.js';
import { startGenesisDevServer } from './devServer.js';
const [command, ...args] = process.argv.slice(2);
const directory = args[0] && !args[0].startsWith('--') ? args.shift()! : command === 'play' ? './my-world' : '.';
const flag = (name: string) => {
  const value = args[args.indexOf(name) + 1];
  if (!value || value.startsWith('--')) throw new Error(`Provide a value for ${name}.`);
  return value;
};
const exists = async (path: string) => { try { await access(path); return true; } catch (error: any) { if (error.code === 'ENOENT') return false; throw error; } };
async function initialize(directory: string, template: string) {
  const project = createGenesisProject(template);
  if (await exists(directory) && (await readdir(directory)).length) throw new Error('Choose an empty directory for a new world. Existing files are preserved.');
  const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), '../examples/assets');
  project.assets = await Promise.all([['end.jpg', 'image/jpeg'], ['scene.mp4', 'video/mp4']].map(async ([name, mimeType]) => ({ path: `assets/${name}`, mimeType, sizeBytes: (await readFile(resolve(fixtures, name))).length })));
  await mkdir(resolve(directory), { recursive: true });
  const { interfaceSource, controllerSource } = project;
  await writeFile(resolve(directory, 'genesis.json'), JSON.stringify(createGenesisProjectManifest(project), null, 2) + '\n', { flag: 'wx' });
  await writeFile(resolve(directory, 'interface.html'), interfaceSource, { flag: 'wx' });
  await writeFile(resolve(directory, 'controller.js'), controllerSource, { flag: 'wx' });
  await writeFile(resolve(directory, 'genesis.schema.json'), JSON.stringify(GENESIS_PROJECT_SCHEMA, null, 2) + '\n', { flag: 'wx' });
  await cp(fixtures, resolve(directory, 'assets'), { recursive: true, errorOnExist: true, force: false });
  console.log(`Created ${resolve(directory)}.`);
}
try {
  if (command === 'play' && args.includes('--template') && await exists(resolve(directory, 'genesis.json'))) throw new Error('This folder already contains a world. Choose a new directory when using --template.');
  if (command === 'init' || command === 'play' && !await exists(resolve(directory, 'genesis.json'))) {
    await initialize(directory, args.includes('--template') ? flag('--template') : command === 'play' ? 'quest' : 'exploration');
    if (command === 'init') console.log(`Run genesis dev ${directory}.`);
  }
  if (command === 'init') {
    // Project creation is complete.
  } else if (command === 'validate') {
    await loadGenesisProjectBundle(resolve(directory)); console.log('Genesis project is valid.');
  } else if (command === 'export') {
    const bundle = await loadGenesisProjectBundle(resolve(directory));
    const output = args.includes('--out') ? flag('--out') : resolve(directory, 'genesis.zip');
    await writeFile(output, exportGenesisProjectArchive(bundle.project, bundle.assetFiles), { flag: 'wx' }); console.log(`Created ${output}.`);
  } else if (command === 'save') {
    const workspaceId = args.includes('--workspace') ? flag('--workspace') : '';
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(workspaceId)) throw new Error('Choose --workspace ID.');
    const apiKey = process.env.SEQUENCER_API_KEY || ''; if (!apiKey) throw new Error('Set SEQUENCER_API_KEY in your server environment.');
    const bundle = await loadGenesisProjectBundle(resolve(directory));
    const result = await new SequencerClient({ apiKey }).save(workspaceId, bundle.project, { assetFiles: bundle.assetFiles, ...(args.includes('--world') ? { liveWorldId: flag('--world') } : {}), ...(args.includes('--version') ? { expectedVersionId: flag('--version') } : {}) });
    console.log(JSON.stringify({ liveWorldId: result.liveWorldId, versionId: result.versionId, previewUrl: result.previewUrl }, null, 2));
  } else if (command === 'dev' || command === 'play') {
    const port = args.includes('--port') ? Number(flag('--port')) : 4173;
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Use a valid port.');
    let server;
    try { server = await startGenesisDevServer(resolve(directory), port); }
    catch (error: any) {
      if (error.code !== 'EADDRINUSE' || args.includes('--port')) throw error;
      server = await startGenesisDevServer(resolve(directory), 0);
    }
    console.log(`\nPlay your world: ${server.url}\n\nEdit ${resolve(directory, 'genesis.json')} for settings.\nEdit interface.html for the look and controller.js for the rules.\nRestart this command after edits. Your previous preview is preserved.\n`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
  } else {
    console.log('genesis play [directory] [--template quest|exploration|timing|decisions|arena|arena-llm] [--port 4173]\ngenesis init <directory> [--template ...]\ngenesis dev <directory> [--port 4173]\ngenesis validate <directory>\ngenesis export <directory> [--out genesis.zip]\ngenesis save <directory> --workspace ID [--world ID --version ID]');
    if (command && command !== '--help' && command !== '-h') throw new Error(`Unknown command: ${command}.`);
  }
} catch (error: any) { console.error(error.message); process.exitCode = 1; }
