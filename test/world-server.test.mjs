import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { startWorldServer } from '../examples/server/server.mjs';
import { createGenesisProject } from '../dist/index.js';

const players = [
  { id: 'red', name: 'Red', token: 'red-test-token-for-the-local-room' },
  { id: 'blue', name: 'Blue', token: 'blue-test-token-for-the-local-room' },
];
test('world server authenticates isolated players, runs jobs and persists a shared battle', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'genesis-world-server-'));
  let room;
  try {
    await cp(new URL('../examples/pokemon-wildclash', import.meta.url), directory, { recursive: true });
    const errors = [];
    room = await startWorldServer({ directory, port: 0, players, onError: e => errors.push(e) });
    const call = async (token, path, data, extra = {}) => {
      const response = await fetch(room.url + path, {
        method: data === undefined ? 'GET' : 'POST',
        headers: { Authorization: 'Bearer ' + token, Origin: room.url, 'Content-Type': 'application/json', ...extra },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      return { status: response.status, data: await response.json() };
    };
    assert.equal((await fetch(room.url)).status, 200);
    assert.equal((await fetch(room.url + '/health')).status, 200);
    assert.equal((await fetch(room.url + '/api/view')).status, 401);
    assert.equal((await fetch(room.url + '/project')).status, 401);
    assert.equal((await call(players[0].token, '/api/join', {}, { Origin: 'https://other.example' })).status, 403);
    const badHost = await new Promise(done => { const req = request(room.url, { headers: { Host: 'evil.example' } }, res => { res.resume(); done(res.statusCode); }); req.end(); });
    assert.equal(badHost, 403);
    const red = players[0].token, blue = players[1].token;
    assert.equal((await call(red, '/api/join', { actorId: 'blue', identityKey: 'blue' })).data.actorId, 'red');
    await call(blue, '/api/join', {});
    const project = (await call(red, '/project')).data;
    assert.equal(project.project.controllerSource, '');
    assert.ok(!project.project.definition.genesis.worldPrompt);
    assert.ok(!JSON.stringify(project).includes(red));
    assert.equal((await call(red, '/api/diagnostics')).status, 404);
    assert.equal((await fetch(room.url + '/assets/start.png')).status, 200);
    assert.equal((await fetch(room.url + '/assets/undeclared.png')).status, 404);
    assert.equal((await fetch(room.url + '/assets/%2e%2e%2fgenesis.json')).status, 404);
    assert.equal((await call(red, '/api/players', { operation: 'claim', seatId: 'trainer_red' })).status, 200);
    assert.equal((await call(blue, '/api/players', { operation: 'claim', seatId: 'trainer_blue' })).status, 200);
    const act = async (token, actionId, data, eventId = crypto.randomUUID()) => {
      const view = (await call(token, '/api/view')).data;
      return call(token, '/api/action', { eventId, actionId, data, revision: view.genesis.revision, actorId: token === red ? 'blue' : 'red' });
    };
    assert.equal((await act(red, 'ready_battle', { pokemonIndex: 3 })).status, 200);
    assert.equal((await act(blue, 'ready_battle', { pokemonIndex: 1 })).status, 200);
    const wait = async predicate => {
      const end = Date.now() + 5000;
      while (!predicate() && Date.now() < end) await new Promise(done => setTimeout(done, 30));
      assert.ok(predicate(), 'The background worker must advance the room.');
    };
    await wait(() => !room.host.diagnostics().state.genesis.server.opening);
    const eventId = crypto.randomUUID();
    const locked = await act(red, 'battle_move', { moveIndex: 3 }, eventId);
    assert.equal(locked.status, 200);
    assert.equal(locked.data.actorId, 'red');
    assert.equal((await act(red, 'battle_move', { moveIndex: 3 }, eventId)).status, 200);
    assert.equal((await act(red, 'battle_move', { moveIndex: 3 })).status, 400);
    const blueView = (await call(blue, '/api/view')).data;
    assert.ok(!('commands' in blueView.genesis.state));
    assert.ok(!('server' in blueView.genesis));
    assert.equal(blueView.genesis.state.sequentialTurns, true);
    await wait(() => { const game = room.host.diagnostics().state.genesis.public; return game.phase === 'battle' && game.activeTurnActorId === 'blue'; });
    assert.equal((await act(blue, 'battle_move', { moveIndex: 3 })).status, 200);
    await wait(() => room.host.diagnostics().state.genesis.public.round === 2);
    const state = room.host.diagnostics().state.genesis.public;
    assert.ok(state.fighters.blue.hp < state.fighters.blue.maxHp);
    const hp = state.fighters.blue.hp;
    await room.close(); room = null;
    room = await startWorldServer({ directory, port: 0, players, onError: e => errors.push(e) });
    await call(red, '/api/join', {});
    const restored = (await call(red, '/api/view')).data;
    assert.equal(restored.genesis.state.round, 2);
    assert.equal(restored.genesis.state.fighters.blue.hp, hp);
    assert.deepEqual(errors, []);
  } finally { await room?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('HTTP credentials follow a player switching between two owned trainer seats', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'genesis-seat-server-'));
  let room;
  try {
    await cp(new URL('../examples/pokemon-wildclash', import.meta.url), directory, { recursive: true });
    room = await startWorldServer({ directory, port: 0, players });
    const post = async (path, data, token = players[0].token) => {
      const response = await fetch(room.url + path, { method: 'POST', headers: { Authorization: 'Bearer ' + token, Origin: room.url, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    await post('/api/join', {});
    await post('/api/players', { operation: 'claim', seatId: 'trainer_red' });
    const blue = await post('/api/players', { operation: 'claim', seatId: 'trainer_blue' });
    assert.notEqual(blue.actorId, 'red');
    const switched = await post('/api/players', { operation: 'claim', seatId: 'trainer_red' });
    assert.equal(switched.actorId, 'red');
    assert.equal(switched.participation.seats.filter(s => s.actorId).length, 2);
    await post('/api/join', {}, players[1].token);
    await post('/api/leave', {});
    assert.equal(room.host.diagnostics().state.participation.seats.filter(s => s.actorId).length, 0);
    assert.deepEqual(room.host.diagnostics().state.participants.map(p => p.id), ['blue']);
    assert.equal((await post('/api/join', {})).actorId, 'red');
  } finally { await room?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('bounded scenes run automatically and each observed playback opens the next turn', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'genesis-clip-server-'));
  let room;
  try {
    const project = createGenesisProject('exploration');
    project.assets = await Promise.all(['end.jpg', 'scene.mp4'].map(async name => ({
      path: 'assets/' + name, mimeType: name.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4',
      sizeBytes: (await readFile(new URL('../examples/assets/' + name, import.meta.url))).length,
    })));
    await writeFile(join(directory, 'genesis.json'), JSON.stringify(project));
    await cp(new URL('../examples/assets', import.meta.url), join(directory, 'assets'), { recursive: true });
    room = await startWorldServer({ directory, port: 0, players: [players[0]] });
    const call = async (path, data) => {
      const response = await fetch(room.url + path, { method: data ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + players[0].token, Origin: room.url, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    await call('/api/join', {});
    let previous = '';
    for (let turn = 0; turn < 2; turn++) {
      const view = await call('/api/view');
      await call('/api/action', { eventId: 'explore-' + turn, actionId: 'explore', data: { x: .5, y: .5, anchorId: view.genesis.anchor.id, sceneRevision: view.genesis.anchor.revision }, revision: view.genesis.revision });
      const deadline = Date.now() + 5000;
      while (room.host.view('red').genesis.stage.mode !== 'playing' && Date.now() < deadline) await new Promise(done => setTimeout(done, 30));
      const playing = await call('/api/view');
      assert.equal(playing.genesis.stage.mode, 'playing');
      assert.equal(playing.genesis.actions[0].canSubmit, false);
      assert.notEqual(playing.genesis.stage.playbackId, previous);
      previous = playing.genesis.stage.playbackId;
      assert.equal((await fetch(room.url + playing.genesis.stage.videoUrl)).status, 200);
      assert.equal((await fetch(room.url + playing.genesis.anchor.imageUrl)).status, 200);
      const completed = await call('/api/playback', { playbackId: previous });
      assert.equal(completed.genesis.actions[0].canSubmit, true);
    }
  } finally { await room?.close(); await rm(directory, { recursive: true, force: true }); }
});
