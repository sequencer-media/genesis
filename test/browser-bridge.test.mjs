import assert from 'node:assert/strict';
import vm from 'node:vm';
import { test } from 'node:test';
import { EXPERIENCE_BRIDGE_MESSAGE, experienceInterfaceBridgeScript, injectExperienceBridge } from '../dist/browser/bridge.js';

test('the host bridge precedes creator markup even with a misleading head tag or no head', () => {
  for (const source of ['<!-- <head> --><html><head></head><body>World</body></html>', '<body>World</body>']) {
    const injected = injectExperienceBridge(source, 'owned-prelude', []);
    assert.ok(injected.startsWith('<!doctype html><html><head><script data-sequencer-experience-bridge>'));
    assert.ok(injected.indexOf('owned-prelude') < injected.indexOf(source));
  }
});

function bridge() {
  const callbacks = {}, parent = { postMessage() {} };
  const window = { parent, addEventListener: (name, fn) => { callbacks[name] = fn; } };
  vm.runInNewContext(experienceInterfaceBridgeScript('ready-test', ['battle']).replace(/^<script[^>]*>|<\/script>$/g, ''), { window, setTimeout, clearTimeout, console });
  const send = (view, nonce = 'ready-test', source = parent) => callbacks.message({ source, data: { type: EXPERIENCE_BRIDGE_MESSAGE, v: 1, nonce, op: 'state', view } });
  return { window, send };
}

test('custom interfaces wait for player seats and game state before their first render', () => {
  const { window, send } = bridge();
  const rendered = [];
  // Generated multiplayer interfaces read the current seats from their state listener.
  assert.doesNotThrow(() => window.Genesis.on('state', () => {
    rendered.push({ seats: window.Genesis.players.get().seats, state: window.Genesis.state.get() });
  }));
  assert.equal(rendered.length, 0);
  const view = { inputs: [], participants: [], participation: { seats: [{ id: 'red', canClaim: true }] }, genesis: { state: { fighters: {} }, actions: [] } };
  send(view, 'wrong-nonce');
  send(view, 'ready-test', {});
  assert.equal(rendered.length, 0);
  send(view);
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].seats[0].id, 'red');
  assert.deepEqual(rendered[0].state, { fighters: {} });
});

test('late subscribers receive the current host view and unsubscribe normally', () => {
  const { window, send } = bridge();
  const view = { inputs: [], genesis: { state: { health: 100 }, actions: [] }, participation: { seats: [] } };
  send(view);
  const states = [], players = [];
  const stop = window.Genesis.state.subscribe(state => states.push(state.health));
  window.Genesis.players.subscribe(value => players.push(value.seats.length));
  assert.deepEqual(states, [100]);
  assert.deepEqual(players, [0]);
  send({ ...view, genesis: { ...view.genesis, state: { health: 80 } } });
  assert.deepEqual(states, [100, 80]);
  stop();
  send({ ...view, genesis: { ...view.genesis, state: { health: 60 } } });
  assert.deepEqual(states, [100, 80]);
});
