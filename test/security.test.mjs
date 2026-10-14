import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, cp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { zipSync, strToU8 } from 'fflate';
import { createGenesisProject } from '../dist/project.js';
import { GenesisHost } from '../dist/host.js';
import { defaultGenesisHostPolicy } from '../dist/policy.js';
import { loadGenesisProject } from '../dist/projectFiles.js';
import { startGenesisDevServer } from '../dist/devServer.js';
import { runGenesisController } from '../dist/genesisController.js';

const localPolicy = { ...defaultGenesisHostPolicy, validateAssetUrl: url => url.startsWith('/assets/') };

test('the host applies its media policy to starting images, covers and authored scenes', () => {
  for (const field of ['start', 'cover', 'scene-image', 'scene-video']) {
    const project = createGenesisProject();
    const remote = 'https://unapproved.invalid/media.mp4';
    if (field === 'start') project.startImageUrl = remote;
    if (field === 'cover') project.coverImageUrl = remote;
    if (field.startsWith('scene')) project.definition.scenes = [{ id: 'remote', title: 'Remote', imageUrl: field === 'scene-image' ? remote : '/assets/end.jpg', videoUrl: field === 'scene-video' ? remote : '', hotspots: [] }];
    assert.throws(() => new GenesisHost('media-policy', project, { policy: localPolicy }), /host media policy/, field);
  }
  assert.doesNotThrow(() => new GenesisHost('local-media', createGenesisProject(), { policy: localPolicy }));
  const relative = createGenesisProject(); relative.startImageUrl = 'assets/end.jpg';
  assert.doesNotThrow(() => new GenesisHost('relative-media', relative));
});

test('file manifests are bounded and cannot be symlinks outside the project', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'genesis-manifest-'));
  const outside = await mkdtemp(join(tmpdir(), 'genesis-external-'));
  try {
    await writeFile(join(outside, 'source.json'), JSON.stringify(createGenesisProject()));
    await symlink(join(outside, 'source.json'), join(directory, 'genesis.json'));
    await assert.rejects(loadGenesisProject(directory), /manifest.*inside the project/i);
    await rm(join(directory, 'genesis.json'));
    await writeFile(join(directory, 'genesis.json'), ' '.repeat(400001));
    await assert.rejects(loadGenesisProject(directory), /manifest.*400 KB/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('the local preview rejects external asset symlinks and sandboxes SVG documents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'genesis-assets-'));
  const outside = await mkdtemp(join(tmpdir(), 'genesis-external-'));
  let server;
  try {
    await writeFile(join(directory, 'genesis.json'), JSON.stringify(createGenesisProject()));
    await cp(new URL('../examples/assets', import.meta.url), join(directory, 'assets'), { recursive: true });
    await writeFile(join(outside, 'private.jpg'), 'outside-project-marker');
    await symlink(join(outside, 'private.jpg'), join(directory, 'assets', 'escape.jpg'));
    server = await startGenesisDevServer(directory, 0);
    assert.equal((await fetch(server.url + '/assets/escape.jpg')).status, 403);
    const svg = await fetch(server.url + '/assets/start.svg');
    assert.equal(svg.status, 200);
    assert.match(svg.headers.get('content-security-policy') || '', /sandbox/);
    assert.match((await fetch(server.url)).headers.get('content-security-policy') || '', /frame-src 'self'/);
    await server.close(); server = null;
    await rm(join(directory, 'assets'), { recursive: true });
    await symlink(outside, join(directory, 'assets'));
    server = await startGenesisDevServer(directory, 0);
    assert.equal((await fetch(server.url + '/assets/private.jpg')).status, 403);
  } finally {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('malformed ZIP64 metadata terminates instead of blocking project import', () => {
  const archive = zipSync({ 'genesis.json': strToU8('{}') });
  const bytes = Buffer.alloc(archive.length + 76);
  const end = archive.length - 22;
  Buffer.from(archive).copy(bytes, 0, 0, end);
  Buffer.from(archive).copy(bytes, end + 76, end);
  const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bytes.writeUInt32LE(0xffffffff, central + 20);
  // ZIP64 end record and locator select ZIP64 parsing, but the entry has no ZIP64 extra field.
  bytes.writeUInt32LE(0x06064b50, end);
  bytes.writeUInt32LE(44, end + 4);
  bytes.writeUInt32LE(1, end + 32);
  bytes.writeUInt32LE(central, end + 48);
  bytes.writeUInt32LE(0x07064b50, end + 56);
  bytes.writeUInt32LE(end, end + 64);
  bytes.writeUInt16LE(0xffff, end + 76 + 8);
  bytes.writeUInt32LE(0xffffffff, end + 76 + 16);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { importGenesisProjectBundle } from './dist/projectArchive.js';
    try { importGenesisProjectBundle(new Uint8Array(Buffer.from(process.argv[1], 'base64'))); process.exit(2); }
    catch { process.exit(0); }
  `, bytes.toString('base64')], { cwd: new URL('..', import.meta.url), timeout: 2000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr?.toString());
});

test('controllers cannot access host globals and infinite computation is interrupted', async () => {
  const result = await runGenesisController(`function onEvent(){return {public:{
    process:typeof process, require:typeof require, fetch:typeof fetch,
    constructorProcess:Function('return typeof process')()
  }}}`, { event: { type: 'probe' } });
  assert.deepEqual(result.public, { process: 'undefined', require: 'undefined', fetch: 'undefined', constructorProcess: 'undefined' });
  await assert.rejects(runGenesisController('function onEvent(){while(true){}}', { event: { type: 'probe' } }), /interrupted/);
});
