import test from 'node:test';
import assert from 'node:assert/strict';
import { mountGenesisPlayer } from '../dist/browser/player.js';
import { createGenesisProject } from '../dist/project.js';

test('new playback IDs restart reused video URLs and acknowledge each clip once', async () => {
  const element = () => ({ style: {}, replaceChildren() {}, append() {} });
  const video = { ...element(), currentTime: 2, src: '', plays: 0, getAttribute() { return this.src; }, async play() { this.plays++; }, pause() {} };
  const image = { ...element(), src: '', getAttribute() { return this.src; } };
  const elements = Object.fromEntries(['.genesis-stage', '.genesis-overlay', '.genesis-panel', '.genesis-controls', '.genesis-status'].map(name => [name, element()]));
  const root = { ...element(), querySelector: name => name === 'video' ? video : name === 'img' ? image : elements[name] };
  const globals = Object.fromEntries(['document', 'window'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  globalThis.document = { createElement: () => root };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const project = createGenesisProject(); project.definition.interface.mode = 'default';
  const view = (id, mode = 'playing') => ({ status: 'active', genesis: { stage: { mode, playbackId: id, videoUrl: '/assets/scene.mp4', overlays: false }, actions: [], jobs: [] } });
  let current = view('clip-1'); const acknowledged = [];
  let player;
  try {
    player = mountGenesisPlayer(element(), project, { read: async () => current, playback: async id => { acknowledged.push(id); current = view(id, 'holding'); return current; } });
    await player.refresh(); assert.equal(video.plays, 1);
    video.onended(); await Promise.resolve(); await Promise.resolve();
    video.onended(); assert.deepEqual(acknowledged, ['clip-1']);
    current = view('clip-2'); video.currentTime = 2;
    await player.refresh(); assert.equal(video.plays, 2); assert.equal(video.currentTime, 0);
    await player.refresh(); assert.equal(video.plays, 2);
    video.onended(); await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(acknowledged, ['clip-1', 'clip-2']);
  } finally {
    player?.destroy();
    for (const [name, descriptor] of Object.entries(globals)) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
});
