import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGenesisProject } from '../dist/project.js';
import { startGenesisDevServer } from '../dist/devServer.js';
test('local runner serves module dependencies, real assets and authenticated actor requests', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'genesis-http-')); let server;
  try {
    await writeFile(join(dir, 'genesis.json'), JSON.stringify(createGenesisProject('exploration'))); await cp(new URL('../examples/assets', import.meta.url), join(dir, 'assets'), { recursive: true });
    server = await startGenesisDevServer(dir, 0);
    const page = await fetch(server.url); assert.equal(page.status, 200); assert.match(await page.text(), /\/browser\/devClient.js/);
    for (const path of ['/browser/devClient.js','/browser/player.js','/browser/bridge.js','/assets/start.svg','/assets/end.jpg','/assets/scene.mp4']) { const result = await fetch(server.url + path); assert.equal(result.status, 200, path); assert.ok((await result.arrayBuffer()).byteLength > 100); }
    const data = await (await fetch(server.url + '/project')).json(), token = data.actors[0].token;
    assert.equal((await fetch(server.url + '/api/view')).status, 401);
    const view = await (await fetch(server.url + '/api/view', { headers: { Authorization: 'Bearer ' + token } })).json();
    const payload = { eventId: 'http1', actionId: 'explore', data: { x: .5, y: .5, anchorId: view.genesis.anchor.id, sceneRevision: view.genesis.anchor.revision }, revision: view.genesis.revision, actorId: 'fake' };
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    assert.equal((await fetch(server.url + '/api/action', { method: 'POST', headers, body: JSON.stringify(payload) })).status, 403);
    const acted = await fetch(server.url + '/api/action', { method: 'POST', headers: { ...headers, Origin: server.url }, body: JSON.stringify(payload) }); assert.equal(acted.status, 200); assert.equal((await acted.json()).actorId, 'player_0');
    assert.equal((await fetch(server.url + '/assets/%2e%2e%2fgenesis.json')).status, 403);
    const denied = await new Promise(resolve => { const req = request(server.url + '/project', { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); }); req.end(); }); assert.equal(denied, 403);
  } finally { await server?.close(); await rm(dir, { recursive: true, force: true }); }
});
test('file-based projects load editable sources and reject files outside the project', async () => {
  const { loadGenesisProject } = await import('../dist/projectFiles.js');
  const dir = await mkdtemp(join(tmpdir(), 'genesis-source-'));
  try {
    const { interfaceSource, controllerSource, ...manifest } = createGenesisProject('timing');
    await writeFile(join(dir, 'interface.html'), interfaceSource); await writeFile(join(dir, 'controller.js'), controllerSource);
    await writeFile(join(dir, 'genesis.json'), JSON.stringify({ ...manifest, interfaceFile: 'interface.html', controllerFile: 'controller.js' }));
    const loaded = await loadGenesisProject(dir); assert.equal(loaded.interfaceSource, interfaceSource); assert.equal(loaded.controllerSource, controllerSource);
    await writeFile(join(dir, 'genesis.json'), JSON.stringify({ ...manifest, interfaceFile: '../outside.html', controllerFile: 'controller.js' }));
    await assert.rejects(loadGenesisProject(dir), /project .html file/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
