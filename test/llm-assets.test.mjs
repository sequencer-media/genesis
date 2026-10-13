import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { createLlmProvider, validateGenesisLlmRequest, validateGenesisLlmResult, createGenesisProject, createGenesisProjectManifest, validateGenesisProject, normalizeGenesisAssets, GenesisHost, defaultGenesisHostPolicy } from '../dist/index.js';
import { exportGenesisProjectArchive, importGenesisProjectBundle } from '../dist/projectArchive.js';
import { loadGenesisProjectBundle } from '../dist/projectFiles.js';

const request = { prompt: 'Create a bounded battle move.', responseSchema: { type: 'object', additionalProperties: false, required: ['name', 'damage'], properties: { name: { type: 'string', maxLength: 60 }, damage: { type: 'integer', minimum: 0, maximum: 40 } } } };
test('LLM schemas reject remote references, unbounded data and invalid attributes', () => {
  assert.deepEqual(validateGenesisLlmResult(request, '{"name":"Ember flash","damage":25}'), { name: 'Ember flash', damage: 25 });
  for (const damage of [-1, 41, '25']) assert.throws(() => validateGenesisLlmResult(request, { name: 'Move', damage }), /schema/);
  assert.throws(() => validateGenesisLlmResult(request, { name: 'Move', damage: 1, script: 'run' }), /schema/);
  assert.throws(() => validateGenesisLlmRequest({ ...request, responseSchema: { $ref: 'https://example.com/schema' } }), /bounded/);
  assert.throws(() => validateGenesisLlmRequest({ ...request, responseSchema: { type: 'array', items: request.responseSchema } }), /Bound LLM arrays/);
  assert.throws(() => validateGenesisLlmRequest({ ...request, prompt: 'x'.repeat(4001) }), /bounded/);
});
test('paid LLM adapters require durable results, deduplicate concurrency and survive adapter recreation', async () => {
  assert.throws(() => createLlmProvider({ paid: true, generate: async () => ({}) }), /durable/);
  const records = new Map(); let calls = 0;
  const options = { paid: true, results: { get: async id => records.get(id) || null, put: async (id, value) => { records.set(id, value); } }, generate: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return { name: 'Tide surge', damage: 30 }; } };
  const provider = createLlmProvider(options), input = { sessionId: 's', idempotencyKey: 'same', job: { effect: { toolId: 'tool.llm.generate', data: request } } };
  const [one, two] = await Promise.all([provider.start(input), provider.start(input)]);
  assert.equal(one.id, two.id); assert.equal(calls, 1);
  const recreated = createLlmProvider(options); assert.equal((await recreated.start(input)).id, one.id); assert.equal(calls, 1);
  assert.equal((await recreated.poll(one.id)).result.data.damage, 30);
});
test('a late LLM reply cannot install moves in a replacement battle', async () => {
  const project = createGenesisProject('decisions'); project.definition.genesis.capabilities = ['tool.llm.generate'];
  project.controllerSource = `function onEvent({state,event}){if(event.type==='session.started')return {server:{battleId:'one'},window:{id:'w',mode:'individual',actionIds:['choose']}};if(event.type==='action')return {effects:[{id:'moves',type:'tool.request',toolId:'tool.llm.generate',data:${JSON.stringify(request)},guard:{key:'battleId',value:'one'},maxCostUsd:.01}]};if(event.type==='participant.left')return {server:{battleId:'two'}};if(event.type==='job.ready')return {public:{move:event.data.data.name}};return {}}`;
  const provider = createLlmProvider({ generate: async () => ({ name: 'Old move', damage: 25 }) });
  const host = await new GenesisHost('guarded', project, { providers: [provider], policy: { ...defaultGenesisHostPolicy, capabilities: ['tool.llm.generate'] } }).initialize();
  await host.join('one', 'One'); await host.join('two', 'Two'); await host.action('one', 'pick', 'choose', { optionId: 'attack' }, host.view('one').genesis.revision);
  const id = host.view('one').genesis.jobs.at(-1).id; await host.runJob('one', id); await host.leave('two'); await host.tick();
  assert.equal(host.view('one').genesis.jobs.at(-1).status, 'cancelled'); assert.equal(host.view('one').genesis.state.move, undefined);
});
test('media bundles retain exact bytes and reject missing, undeclared and escaping files', () => {
  const project = createGenesisProject(); const bytes = new Uint8Array([1, 2, 3]);
  project.assets = [{ path: 'assets/art/start.png', mimeType: 'image/png', sizeBytes: 3 }]; project.startImageUrl = '/assets/art/start.png';
  const bundle = importGenesisProjectBundle(exportGenesisProjectArchive(project, { 'assets/art/start.png': bytes }));
  assert.deepEqual(bundle.assetFiles['assets/art/start.png'], bytes); assert.deepEqual(bundle.project.assets, project.assets);
  assert.throws(() => exportGenesisProjectArchive(project), /complete asset/);
  assert.throws(() => normalizeGenesisAssets([{ ...project.assets[0], path: 'assets/../key.png' }]), /relative/);
  assert.throws(() => normalizeGenesisAssets([{ ...project.assets[0], mimeType: 'text/html' }]), /MIME/);
  const archive = { 'genesis.json': strToU8(JSON.stringify(createGenesisProjectManifest(project))), 'interface.html': strToU8(project.interfaceSource), 'controller.js': strToU8(project.controllerSource), 'assets/art/start.png': bytes };
  assert.throws(() => importGenesisProjectBundle(zipSync({ ...archive, '.env': strToU8('secret') })), /only project/);
  assert.throws(() => importGenesisProjectBundle(zipSync({ ...archive, 'assets/other.png': bytes })), /declared/);
});
test('local bundle loader rejects a symlink escaping the project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'genesis-assets-'));
  try {
    const project = createGenesisProject(); project.assets = [{ path: 'assets/out.png', mimeType: 'image/png', sizeBytes: 3 }];
    const dir = join(root, 'project'); await mkdir(join(dir, 'assets'), { recursive: true }); await writeFile(join(root, 'outside.png'), new Uint8Array([1, 2, 3]));
    await symlink(join(root, 'outside.png'), join(dir, 'assets/out.png'));
    await writeFile(join(dir, 'genesis.json'), JSON.stringify(createGenesisProjectManifest(project))); await writeFile(join(dir, 'interface.html'), project.interfaceSource); await writeFile(join(dir, 'controller.js'), project.controllerSource);
    await assert.rejects(loadGenesisProjectBundle(dir), /stay inside/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
