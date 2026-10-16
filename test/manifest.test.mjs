import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGenesisProjectManifest, createGenesisProject, createGenesisProjectManifest, normalizeExperienceDefinition, normalizeStreamChunkIntervalSeconds, genesisContext, createGenesisState } from '../dist/index.js';

test('manifest settings round trip independently of interface and controller contents', () => {
  const project = createGenesisProject('decisions'), manifest = createGenesisProjectManifest(project);
  assert.equal(manifest.interfaceFile, 'interface.html');
  assert.equal(manifest.controllerFile, 'controller.js');
  assert.equal(Object.hasOwn(manifest, 'interfaceSource'), false);
  assert.equal(Object.hasOwn(manifest, 'controllerSource'), false);
  manifest.title = 'Crowd challenge';
  manifest.description = 'Choose the next move.';
  manifest.definition.genesis.config.voteSeconds = 10;
  manifest.definition.worldVideo.chunkIntervalSeconds = 5;
  const applied = applyGenesisProjectManifest(JSON.parse(JSON.stringify(manifest)), project.interfaceSource, project.controllerSource);
  assert.equal(applied.title, 'Crowd challenge');
  assert.equal(applied.description, 'Choose the next move.');
  assert.equal(applied.definition.genesis.config.voteSeconds, 10);
  assert.equal(applied.definition.worldVideo.chunkIntervalSeconds, 5);
  assert.equal(applied.interfaceSource, project.interfaceSource);
  assert.equal(applied.controllerSource, project.controllerSource);
});

test('editor manifests reject missing source references, inline source and invalid configuration', () => {
  const p = createGenesisProject(), manifest = createGenesisProjectManifest(p);
  const apply = value => applyGenesisProjectManifest(value, p.interfaceSource, p.controllerSource);
  assert.throws(() => apply({ ...manifest, interfaceFile: '../other.html' }), /Reference interface/);
  assert.throws(() => apply({ ...manifest, controllerSource: 'replacement' }), /Edit source code/);
  assert.throws(() => apply({ ...manifest, title: '' }), /with a title/);
  assert.throws(() => apply({ ...manifest, definition: { ...p.definition, worldVideo: { ...p.definition.worldVideo, chunkIntervalSeconds: '10' } } }), /chunk interval/);
});

test('chunk cadence defaults to 14 and travels through JSON and controller context', () => {
  const p = createGenesisProject(), without = structuredClone(p.definition);
  delete without.worldVideo.chunkIntervalSeconds;
  assert.equal(normalizeExperienceDefinition(without).worldVideo.chunkIntervalSeconds, 14);
  for (const seconds of [5, 10, 14, 124 / 24, 14.375]) {
    const def = normalizeExperienceDefinition({ ...p.definition, worldVideo: { ...p.definition.worldVideo, chunkIntervalSeconds: seconds } });
    const context = genesisContext(def, createGenesisState(def), { id: 'test', type: 'session.started', data: {}, now: 1000 }, []);
    assert.equal(context.config.video.chunkIntervalSeconds, seconds);
    assert.equal(JSON.parse(JSON.stringify(def)).worldVideo.chunkIntervalSeconds, seconds);
  }
  for (const invalid of [null, '14', 0, -1, 31, NaN, Infinity]) assert.throws(() => normalizeStreamChunkIntervalSeconds(invalid), /chunk interval/);
});
