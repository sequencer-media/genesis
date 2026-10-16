import test from 'node:test';
import assert from 'node:assert/strict';
import { mountGenesisPlayer } from '../dist/browser/player.js';
import { createGenesisProject } from '../dist/project.js';

test('new playback IDs restart reused video URLs and acknowledge each clip once despite a stale read', async () => {
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
  let current = view('clip-1'), delayedRead; const acknowledged = [];
  let player;
  try {
    player = mountGenesisPlayer(element(), project, { read: () => delayedRead ? delayedRead() : Promise.resolve(current), playback: async id => { acknowledged.push(id); current = view(id, 'holding'); return current; } });
    await player.refresh(); assert.equal(video.plays, 1);
    video.onended(); await Promise.resolve(); await Promise.resolve();
    video.onended(); assert.deepEqual(acknowledged, ['clip-1']);
    current = view('clip-2'); video.currentTime = 2;
    await player.refresh(); assert.equal(video.plays, 2); assert.equal(video.currentTime, 0);
    await player.refresh(); assert.equal(video.plays, 2);
    const staleView = current; let release;
    delayedRead = () => new Promise(done => { release = done; });
    const stalePoll = player.refresh();
    video.onended(); await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(acknowledged, ['clip-1', 'clip-2']);
    assert.equal(video.hidden, true);
    release(staleView); await stalePoll;
    assert.equal(video.hidden, true, 'A pre-action read cannot restore old playback after completion.');
  } finally {
    player?.destroy();
    for (const [name, descriptor] of Object.entries(globals)) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
});

test('combat media fills a 16:9 viewer from 1344x768 source while pointer geometry accounts for the crop', async () => {
  const descriptors = Object.fromEntries(['document', 'window', 'location'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const element = () => ({ style: {}, replaceChildren() {}, append() {}, addEventListener() {} });
  const expected = ['contain', 'cover'];
  try {
    for (const fit of expected) {
      const messages = [];
      const video = { ...element(), videoWidth: 1344, videoHeight: 768, pause() {} };
      const image = { ...element(), naturalWidth: 1344, naturalHeight: 768, getAttribute() { return ''; } };
      const frame = { ...element(), sandbox: { add() {} }, contentWindow: { postMessage(message) { messages.push(message); } } };
      const elements = Object.fromEntries(['.genesis-stage', '.genesis-overlay', '.genesis-panel', '.genesis-controls', '.genesis-status'].map(name => [name, element()]));
      elements['.genesis-stage'].getBoundingClientRect = () => ({ width: 1000, height: 562.5 });
      const root = { ...element(), querySelector: name => name === 'video' ? video : name === 'img' ? image : elements[name] };
      globalThis.document = { createElement: name => name === 'iframe' ? frame : root };
      globalThis.window = { addEventListener() {}, removeEventListener() {} };
      globalThis.location = { origin: 'http://localhost' };
      const project = createGenesisProject(); project.definition.interface.mode = 'custom'; project.definition.interface.placement = 'panel'; project.interfaceSource = '<html><head></head><body></body></html>';
      if (fit === 'cover') project.definition.rules.resolver = 'combat';
      const view = { status: 'active', genesis: { stage: { mode: 'holding', overlays: true }, actions: [], jobs: [] } };
      const player = mountGenesisPlayer(element(), project, { read: async () => view });
      try {
        await player.refresh();
        assert.equal(video.style.objectFit, fit); assert.equal(image.style.objectFit, fit);
        const g = messages.at(-1).view.stageGeometry;
        if (fit === 'cover') { assert.equal(g.width, 1); assert.ok(g.y < 0); assert.ok(g.height > 1); }
        else { assert.ok(g.x > 0); assert.equal(g.height, 1); }
        assert.equal((.5 - g.x) / g.width, .5); assert.equal((.5 - g.y) / g.height, .5);
      } finally { player.destroy(); }
    }
  } finally {
    for (const [name, descriptor] of Object.entries(descriptors)) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
});
