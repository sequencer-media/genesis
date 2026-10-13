import test from 'node:test';
import assert from 'node:assert/strict';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { GENESIS_PROJECT_SCHEMA, createGenesisProject, createGenesisProjectManifest, applyGenesisProjectManifest, exportGenesisProjectArchive, importGenesisProjectArchive, validateGenesisProject, GenesisHost, normalizeStageAspectRatio } from '../dist/index.js';

test('stage shape defaults to widescreen and round trips custom ratios without changing media settings', () => {
  const p = createGenesisProject();
  assert.equal(normalizeStageAspectRatio(p.definition.interface.stageAspectRatio), 16 / 9);
  const legacy = structuredClone(p); delete legacy.definition.interface.stageAspectRatio;
  assert.equal(normalizeStageAspectRatio(validateGenesisProject(legacy).definition.interface.stageAspectRatio), 16 / 9);
  for (const ratio of [.5625, 1, 2.4, .25, 4]) {
    p.definition.interface.stageAspectRatio = ratio;
    const restored = importGenesisProjectArchive(exportGenesisProjectArchive(p));
    assert.equal(restored.definition.interface.stageAspectRatio, ratio);
    assert.deepEqual(restored.definition.worldVideo, p.definition.worldVideo);
  }
  for (const ratio of [0, -.5, .24, 4.01, Infinity, NaN, '16:9']) {
    p.definition.interface.stageAspectRatio = ratio;
    assert.throws(() => validateGenesisProject(p), /stage aspect ratio/);
  }
});

test('portable manifest strips package IDs and saved game connections without changing the hosted definition', () => {
  const p = createGenesisProject(); p.definition.interface.packageVersion = 'private_ui'; p.definition.genesis.packageVersion = 'private_controller';
  p.definition.gameBindings = [{ gameId: 'private_game', versionId: 'private_version' }];
  const manifest = createGenesisProjectManifest(p);
  assert.equal(manifest.definition.interface.packageVersion, ''); assert.equal(manifest.definition.genesis.packageVersion, ''); assert.deepEqual(manifest.definition.gameBindings, []);
  assert.equal(p.definition.interface.packageVersion, 'private_ui'); assert.equal(p.definition.gameBindings[0].gameId, 'private_game');
  assert.throws(() => exportGenesisProjectArchive(p), /connected game code/);
});
test('JSON Schema validates manifest and rejects misplaced product authority and unknown fields', () => {
  const p = createGenesisProject(), manifest = createGenesisProjectManifest(p), check = new Ajv2020({ strict: false }).compile(GENESIS_PROJECT_SCHEMA);
  assert.equal(check(manifest), true);
  for (const key of ['workspaceId', 'ownerUserId', 'publicationStatus', 'hostPolicy', 'gemRatePerSecond', 'providerCredentials']) {
    const invalid = { ...manifest, [key]: {} };
    assert.equal(check(invalid), false); assert.throws(() => applyGenesisProjectManifest(invalid, p.interfaceSource, p.controllerSource), /outside Genesis/);
  }
  assert.throws(() => applyGenesisProjectManifest({ ...manifest, definition: { ...manifest.definition, genesis: { ...manifest.definition.genesis, walletBalance: 1000 } } }, p.interfaceSource, p.controllerSource), /walletBalance/);
  assert.throws(() => applyGenesisProjectManifest({ ...manifest, definition: { ...manifest.definition, participation: { ...manifest.definition.participation, maxPlayers: 1000 } } }, p.interfaceSource, p.controllerSource), /1 to 100/);
});
test('archive round trips separate files, metadata, content preferences and inert namespaced extensions', () => {
  const p = createGenesisProject('decisions'); p.coverImageUrl = 'https://example.com/cover.webp'; p.startImageUrl = 'https://example.com/start.webp';
  p.extensions = { 'org.example': { edition: 3, capability: 'custom.request' } }; p.definition.interface.chat = { presentation: 'minimized', reactions: false };
  const archive = exportGenesisProjectArchive(p), entries = unzipSync(archive), manifest = JSON.parse(strFromU8(entries['genesis.json']));
  assert.deepEqual(Object.keys(entries).sort(), ['controller.js', 'genesis.json', 'genesis.schema.json', 'interface.html']);
  assert.equal(Object.hasOwn(manifest, 'controllerSource'), false); assert.equal(Object.hasOwn(manifest, 'interfaceSource'), false);
  const restored = importGenesisProjectArchive(archive);
  assert.deepEqual(restored, validateGenesisProject(p));
  assert.deepEqual(restored.definition.genesis.capabilities, p.definition.genesis.capabilities);
});
test('archive imports reject oversized sources and missing or escaping entry files', () => {
  const p = createGenesisProject(), files = { 'genesis.json': strToU8(JSON.stringify(createGenesisProjectManifest(p))), 'interface.html': strToU8(p.interfaceSource), 'controller.js': strToU8(p.controllerSource) };
  assert.throws(() => importGenesisProjectArchive(zipSync({ ...files, 'interface.html': strToU8('x'.repeat(200001)) })), /source limits/);
  const { 'interface.html': _, ...missing } = files;
  assert.throws(() => importGenesisProjectArchive(zipSync(missing)), /Include genesis.json/);
  assert.throws(() => importGenesisProjectArchive(zipSync({ ...files, 'genesis.json': strToU8(JSON.stringify({ ...createGenesisProjectManifest(p), interfaceFile: '../interface.html' })) })), /Reference interface/);
});
test('cover and initial scene remain independent in the reference host', async () => {
  const p = createGenesisProject('timing'); p.coverImageUrl = 'https://example.com/cover.webp'; p.startImageUrl = 'https://example.com/start.webp';
  const host = await new GenesisHost('cover-test', p).initialize(); await host.join('player', 'Player');
  assert.equal(host.view('player').genesis.anchor.imageUrl, p.startImageUrl);
});
test('extensions are namespaced bounded data and cannot grant a tool capability', () => {
  const p = createGenesisProject();
  assert.throws(() => validateGenesisProject({ ...p, extensions: { hostPolicy: {} } }), /pattern/);
  const accepted = validateGenesisProject({ ...p, extensions: { 'org.example': { capabilities: ['tool.private'] } } });
  assert.equal(accepted.definition.genesis.capabilities.includes('tool.private'), false);
});

test('multibyte source limits agree with archive extraction limits', () => {
  const p = createGenesisProject(); p.interfaceSource = '界'.repeat(66666);
  assert.equal(importGenesisProjectArchive(exportGenesisProjectArchive(p)).interfaceSource, p.interfaceSource);
  assert.throws(() => validateGenesisProject({ ...p, interfaceSource: '界'.repeat(66667) }), /UTF-8 bytes/);
});
