import test from 'node:test';
import assert from 'node:assert/strict';
import { GenesisHost, createGenesisProject, MemoryGenesisStorage, exportGenesisProjectArchive, importGenesisProjectArchive } from '../dist/index.js';

async function game(project = createGenesisProject('quest'), storage = new MemoryGenesisStorage()) {
  const host = await new GenesisHost('lantern-run', project, { storage }).initialize();
  await host.join('one', 'Adventurer');
  let sequence = 0;
  const choose = optionId => host.action('one', 'move-' + (++sequence), 'choose', { optionId }, host.view('one').genesis.revision);
  return { host, choose, storage, project };
}

test('the quest starts with one player and immediate actions, with no providers or tool jobs', async () => {
  const { host } = await game(); const view = host.view('one');
  assert.equal(view.status, 'active'); assert.equal(view.genesis.actions[0].canSubmit, true);
  assert.equal(view.genesis.state.stars, 0); assert.equal(view.genesis.state.options.length, 3);
  assert.deepEqual(host.project.definition.genesis.capabilities, []); assert.deepEqual(view.genesis.jobs, []);
  assert.equal(host.project.startImageUrl, '');
});

test('a thoughtful route wins, preserves its result across restarts, and can be replayed', async () => {
  const { host, choose, project, storage } = await game();
  for (const move of ['listen', 'fox', 'ward', 'strike', 'strike', 'strike']) await choose(move);
  let state = host.view('one').genesis.state;
  assert.equal(state.status, 'won'); assert.equal(state.stars, 3); assert.equal(state.wins, 1);
  assert.equal(state.health, 4); assert.equal(state.light, 5); assert.equal(state.fox, true);
  const resumed = await new GenesisHost('lantern-run', project, { storage }).initialize();
  assert.equal(resumed.view('one').genesis.state.status, 'won');
  await choose('restart'); state = host.view('one').genesis.state;
  assert.equal(state.status, 'playing'); assert.equal(state.stars, 0); assert.equal(state.wins, 1);
  assert.equal(state.health, 6); assert.equal(state.light, 10);
});

test('risky decisions can lose, and restart provides a fresh playable run', async () => {
  const { host, choose } = await game();
  for (const move of ['rush', 'ford', 'pass', 'strike', 'strike']) await choose(move);
  assert.equal(host.view('one').genesis.state.status, 'lost');
  assert.equal(host.view('one').genesis.state.health, 0);
  await assert.rejects(choose('strike'), /available move/);
  await choose('restart'); assert.equal(host.view('one').genesis.state.room, 0);
  assert.equal(host.view('one').genesis.actions[0].canSubmit, true);
});

test('current choices, typed data, actor ownership and revisions remain authoritative', async () => {
  const project = createGenesisProject('quest'); project.definition.participation.spectators = true;
  const { host } = await game(project); await host.join('watcher', 'Watcher', 'spectator');
  const before = host.view('one');
  await assert.rejects(host.action('watcher', 'wrong', 'choose', { optionId: 'listen' }, before.genesis.revision), /another participant/);
  await assert.rejects(host.action('one', 'cheat', 'choose', { optionId: 'listen', health: 999 }, before.genesis.revision), /declared action fields/);
  await assert.rejects(host.action('one', 'future', 'choose', { optionId: 'spark' }, before.genesis.revision), /available move/);
  await host.action('one', 'once', 'choose', { optionId: 'listen' }, before.genesis.revision);
  await host.action('one', 'once', 'choose', { optionId: 'listen' }, before.genesis.revision);
  assert.equal(host.view('one').genesis.state.stars, 1);
  await assert.rejects(host.action('one', 'stale', 'choose', { optionId: 'fox' }, before.genesis.revision), /scene changed/);
});

test('settings remix the game and its complete project survives a portable export', async () => {
  const project = createGenesisProject('quest');
  project.definition.genesis.config = { worldName: 'Moonmoth', lanternTurns: 8, difficulty: 'hard' };
  const restored = importGenesisProjectArchive(exportGenesisProjectArchive(project));
  const { host, choose } = await game(restored);
  assert.equal(host.view('one').genesis.state.title, 'Moonmoth');
  assert.equal(host.view('one').genesis.state.light, 8); assert.equal(host.view('one').genesis.state.enemy, 10);
  for (const move of ['listen', 'fox', 'ward', 'strike', 'guard', 'strike', 'guard', 'strike', 'strike']) await choose(move);
  assert.equal(host.view('one').genesis.state.status, 'lost'); // This harder route exhausts an eight-light lantern.
  assert.deepEqual(host.view('one').genesis.jobs, []);
});
