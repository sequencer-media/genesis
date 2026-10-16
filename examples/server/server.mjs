import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import {
  GenesisHost, FileGenesisStorage, createCachedProvider, createLlmProvider,
  defaultGenesisHostPolicy, genesisParticipantRole, loadGenesisProject, publicExperienceDefinition, genesisRequiredFrameStatus, genesisDispatchOrder,
} from '../../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const runtime = resolve(here, '../../dist/browser');
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const digest = token => createHash('sha256').update(token).digest('hex');

/** One process, one persistent room. Credentials and provider clients stay on this server. */
export async function startWorldServer({
  directory = resolve(here, '../pokemon-wildclash'), port = 4174, hostname = '127.0.0.1', origin,
  players, providers, services, policy, storage, sessionId = 'world', onError = console.error,
} = {}) {
  directory = await realpath(directory);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Choose a valid port.');
  if (origin && (new URL(origin).origin !== origin || !/^https?:\/\//.test(origin))) throw new Error('Set a complete HTTP or HTTPS origin without a path.');
  if (!players?.length || players.length > 100) throw new Error('Configure 1 to 100 server-side player credentials.');
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname) && !origin?.startsWith('https://')) throw new Error('Set an HTTPS public origin when listening beyond loopback.');
  const credentials = new Map();
  for (const player of players) {
    if (typeof player.token !== 'string' || player.token.length < 24 || player.token.length > 256 || !/^[A-Za-z0-9_-]{1,48}$/.test(player.id) || !player.name?.trim() || player.name.length > 60) throw new Error('Each player needs a unique token (24 to 256 characters), safe ID and name.');
    if (credentials.has(digest(player.token)) || [...credentials.values()].some(p => p.id === player.id)) throw new Error('Use distinct player credentials and IDs.');
    credentials.set(digest(player.token), { id: player.id, name: player.name, identityKey: player.identityKey || player.id, actorId: player.id });
  }
  const project = await loadGenesisProject(directory);
  const fixtures = providers === undefined;
  const moves = fixtures ? JSON.parse(await readFile(resolve(here, '../fixtures/arena-moves.json'), 'utf8')) : null;
  providers ??= [
    createCachedProvider([{ imageUrl: '/assets/__genesis_fixture/end.jpg', videoUrl: '/assets/__genesis_fixture/scene.mp4' }], { simulateLiveDirections: true }),
    createLlmProvider({ id: 'local-move-fixture', generate: async () => moves }),
  ];
  const host = await new GenesisHost(sessionId, project, {
    storage: storage || new FileGenesisStorage(resolve(directory, '.genesis/server')),
    providers, services,
    policy: policy || { ...defaultGenesisHostPolicy, capabilities: [...defaultGenesisHostPolicy.capabilities, 'tool.llm.generate'] },
  }).initialize();
  let publicOrigin = origin ? new URL(origin).origin : '';
  const publicProject = { ...project, definition: publicExperienceDefinition(project.definition), controllerSource: '' };
  const join = player => host.join(player.actorId, player.name, project.definition.participation.seats ? 'spectator' : 'player', player.identityKey);
  const body = async req => {
    let bytes = 0, chunks = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 20000) throw new Error('Keep requests below 20 KB.');
      chunks.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Send a JSON object.');
    return input;
  };
  const server = createServer(async (req, res) => {
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.headers.host !== new URL(publicOrigin).host) return json(403, { error: 'Use the configured room URL.' });
      const url = new URL(req.url || '/', publicOrigin);
      if (url.pathname === '/health' && req.method === 'GET') return json(200, { ok: true });
      if (url.pathname === '/project' || url.pathname.startsWith('/api/')) {
        const token = /^Bearer ([^\s]{24,256})$/.exec(req.headers.authorization || '')?.[1];
        const player = token && credentials.get(digest(token));
        if (!player) return json(401, { error: 'Enter your room access token.' });
        if (req.method === 'POST' && req.headers.origin !== publicOrigin) return json(403, { error: 'Use a same-origin room request.' });
        if (url.pathname === '/api/join' && req.method === 'POST') return json(200, await join(player));
        if (url.pathname === '/project' && req.method === 'GET') return json(200, { project: publicProject, fixtures });
        if (url.pathname === '/api/view' && req.method === 'GET') return json(200, await host.read(player.actorId));
        if (url.pathname === '/api/queue' && req.method === 'GET') return json(200, (await host.read(player.actorId)).genesis.queue);
        if (req.method !== 'POST') return json(404, { error: 'Unknown room route.' });
        const input = await body(req);
        let result;
        switch (url.pathname) {
          case '/api/leave': {
            const state = host.diagnostics().state;
            const owned = state.participation
              ? state.participants.filter(p => state.participation.identities[p.id] === player.identityKey).map(p => p.id)
              : [player.actorId];
            for (const id of owned) await host.leave(id);
            player.actorId = player.id;
            result = { left: true };
            break;
          }
          case '/api/action': result = await host.action(player.actorId, input.eventId, input.actionId, input.data, input.revision); break;
          case '/api/players': result = await host.players(player.actorId, input); player.actorId = result.actorId; break;
          case '/api/playback': result = await host.playback(player.actorId, input.playbackId); break;
          case '/api/run': result = await host.runJob(player.actorId, input.jobId); break;
          case '/api/retry': result = await host.retry(player.actorId, input.jobId); break;
          case '/api/skip': result = await host.skip(player.actorId, input.jobId); break;
          default: return json(404, { error: 'Unknown room route.' });
        }
        return json(200, result);
      }
      if (req.method !== 'GET') return json(405, { error: 'Use GET.' });
      let file;
      if (url.pathname === '/') file = resolve(here, 'index.html');
      else if (url.pathname === '/client.js') file = resolve(here, 'client.js');
      else if (/^\/browser\/[A-Za-z]+\.js$/.test(url.pathname)) file = resolve(runtime, url.pathname.slice('/browser/'.length));
      else if (fixtures && url.pathname === '/assets/__genesis_fixture/end.jpg') file = resolve(here, '../assets/end.jpg');
      else if (fixtures && url.pathname === '/assets/__genesis_fixture/scene.mp4') file = resolve(here, '../assets/scene.mp4');
      else if (url.pathname.startsWith('/assets/')) {
        const path = decodeURIComponent(url.pathname).slice(1);
        if (!project.assets?.some(asset => asset.path === path)) return json(404, { error: 'Unknown project asset.' });
        file = await realpath(resolve(directory, path));
        if (!file.startsWith(directory + sep) || !mime[extname(file)] || extname(file) === '.js' || extname(file) === '.html') return json(403, { error: 'Choose a declared media asset.' });
      }
      if (!file) return json(404, { error: 'Not found.' });
      const bytes = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length,
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        // srcdoc inherits this policy; its own stricter sandbox policy limits creator code.
        ...(extname(file) === '.html' ? { 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; media-src 'self' https:; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'" } : {}),
        ...(extname(file) === '.svg' ? { 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}),
      });
      res.end(bytes);
    } catch (error) { json(400, { error: String(error.message || 'Room request failed.').slice(0, 240) }); }
  });
  server.requestTimeout = 10000;
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(port, hostname, () => { server.off('error', reject); done(); });
  });
  publicOrigin ||= `http://${hostname === '::1' ? '[::1]' : hostname}:${server.address().port}`;
  let working = null, closing = false;
  const work = async () => {
    // Tick timers and poll durable provider handles even when no browser is connected.
    await host.tick();
    const state = host.diagnostics().state;
    const actor = state.participants.find(p => genesisParticipantRole(state, p) === 'player');
    const ordered=genesisDispatchOrder(state.genesis),firstDirection=ordered.find(j=>j.effect.type==='live.direction');
    if (actor) for (const job of ordered.filter(j => j.status === 'queued'&&genesisRequiredFrameStatus(state.genesis,j)!=='waiting')) {if(job.effect.type==='live.direction'&&job.id!==firstDirection?.id)continue;await host.runJob(actor.id, job.id);}
  };
  const timer = setInterval(() => {
    if (working || closing) return;
    working = work().catch(onError).finally(() => { working = null; });
  }, 250);
  return {
    url: publicOrigin, host,
    async close() {
      closing = true; clearInterval(timer);
      const stopped = new Promise(done => server.close(done));
      server.closeAllConnections();
      await stopped; await working;
    },
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const players = process.env.GENESIS_PLAYERS_FILE
      ? JSON.parse(await readFile(resolve(process.env.GENESIS_PLAYERS_FILE), 'utf8'))
      : ['red', 'blue', 'watcher'].map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), token: randomBytes(24).toString('base64url') }));
    if (!process.env.GENESIS_PLAYERS_FILE && process.env.HOST && process.env.HOST !== '127.0.0.1') throw new Error('Configure GENESIS_PLAYERS_FILE before binding a public server.');
    const adapters = process.env.GENESIS_PROVIDER_MODULE ? await import(pathToFileURL(resolve(process.env.GENESIS_PROVIDER_MODULE)).href) : {};
    if (process.env.GENESIS_PROVIDER_MODULE && !Array.isArray(adapters.providers)) throw new Error('The provider module must export a providers array.');
    const room = await startWorldServer({
      directory: process.argv[2] ? resolve(process.argv[2]) : undefined,
      port: Number(process.env.PORT || 4174), hostname: process.env.HOST || '127.0.0.1', origin: process.env.GENESIS_ORIGIN,
      players, providers: adapters.providers, services: adapters.services, policy: adapters.policy,
    });
    console.log(`World server: ${room.url}`);
    if (!process.env.GENESIS_PLAYERS_FILE) for (const player of players) console.log(`${player.name} access token: ${player.token}`);
    console.log(adapters.providers ? 'Connected server-side providers.' : 'Prepared fixtures. Live directions are simulated; no model requests or charges.');
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await room.close(); process.exit(0); });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
