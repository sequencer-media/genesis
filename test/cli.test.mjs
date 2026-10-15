import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const command = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000 });
async function preview(directory) {
  const child = spawn(process.execPath, [cli, 'play', directory, '--port', '0']);
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Preview did not start: ' + output)); }, 10000);
    child.stdout.on('data', bytes => { output += bytes; const match = /Play your world: (http:\/\/127\.0\.0\.1:\d+)/.exec(output); if (match) { clearTimeout(timer); resolve(match[1]); } });
    child.stderr.on('data', bytes => { output += bytes; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Preview exited: ' + code + ' ' + output)); });
  });
  const data = await (await fetch(url + '/project')).json();
  const call = async (path, payload) => {
    const response = await fetch(url + '/api/' + path, { method: payload ? 'POST' : 'GET', headers: { Origin: url, Authorization: 'Bearer ' + data.actors[0].token, 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    assert.equal(response.status, 200); return response.json();
  };
  return { call, data, async close() { const closed = once(child, 'exit'); child.kill('SIGTERM'); await closed; } };
}

test('play creates a solo game, reopens existing work, and preserves progress by project version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'genesis-play-')), directory = join(root, 'my-world'); let server;
  try {
    server = await preview(directory); assert.equal(server.data.project.title, 'Mosslight: Lantern Run');
    assert.equal(server.data.actors.length, 1);
    const before = await server.call('view'); assert.equal(before.genesis.actions[0].canSubmit, true);
    const replace = command('play', directory, '--template', 'arena'); assert.equal(replace.status, 1); assert.match(replace.stderr, /new directory/);
    await server.call('action', { eventId: 'first-choice', actionId: 'choose', data: { optionId: 'listen' }, revision: before.genesis.revision });
    await server.close(); server = null;
    const file = join(directory, 'genesis.json'), original = await readFile(file, 'utf8'), changed = JSON.parse(original);
    changed.definition.genesis.config.worldName = 'Moonmoth'; await writeFile(file, JSON.stringify(changed));
    server = await preview(directory); assert.equal((await server.call('view')).genesis.state.title, 'Moonmoth');
    assert.equal((await server.call('view')).genesis.state.turn, 0);
    await server.close(); server = null;
    await writeFile(file, original);
    server = await preview(directory); assert.equal((await server.call('view')).genesis.state.stars, 1);
    assert.equal((await server.call('view')).genesis.state.fox, true);
    assert.equal(command('validate', directory).status, 0);
    assert.equal(command('export', directory, '--out', join(root, 'my-world.zip')).status, 0);
  } finally { await server?.close(); await rm(root, { recursive: true, force: true }); }
});

test('the CLI preserves existing files and reports missing flags or unknown commands', async () => {
  const root = await mkdtemp(join(tmpdir(), 'genesis-cli-'));
  try {
    await writeFile(join(root, 'notes.txt'), 'keep me');
    const occupied = command('init', root, '--template', 'quest'); assert.equal(occupied.status, 1); assert.match(occupied.stderr, /empty directory/);
    assert.equal(await readFile(join(root, 'notes.txt'), 'utf8'), 'keep me');
    const flag = command('init', join(root, 'missing'), '--template'); assert.equal(flag.status, 1); assert.match(flag.stderr, /value for --template/);
    assert.equal(command('unknown').status, 1); assert.equal(command('--help').status, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
