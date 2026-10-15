import { mountGenesisPlayer } from './player.js';
const data = await (await fetch('/project')).json(), select = document.getElementById('actor') as HTMLSelectElement;
document.getElementById('title')!.textContent = data.project.title;
for (const actor of data.actors) { const option = document.createElement('option'); option.value = actor.token; option.textContent = actor.name || actor.id; select.append(option); }
select.hidden = data.actors.length === 1;
document.getElementById('player-help')!.hidden = !data.project.definition.participation.seats;
if (!data.project.definition.genesis.capabilities.length) document.getElementById('preview-note')!.textContent = 'Runs locally. Your progress is saved. No account or API key needed.';
let player: ReturnType<typeof mountGenesisPlayer>;
const call = async (path: string, input?: unknown) => { const response = await fetch(`/api/${path}`, { method: input ? 'POST' : 'GET', headers: { Authorization: `Bearer ${select.value}`, 'Content-Type': 'application/json' }, ...(input ? { body: JSON.stringify(input) } : {}) }); if (response.status === 401) location.reload(); const value = await response.json(); if (!response.ok) throw new Error(value.error); return value; };
const install = () => { player?.destroy(); player = mountGenesisPlayer(document.getElementById('player')!, data.project, { read: () => call('view'), players: request => call('players', request), action: (eventId, actionId, payload, revision) => call('action', { eventId, actionId, data: payload, revision }), playback: playbackId => call('playback', { playbackId }), runJob: jobId => call('run', { jobId }), skip: jobId => call('skip', { jobId }), retry: jobId => call('retry', { jobId }) }); };
select.onchange = install; document.getElementById('refresh')!.onclick = () => location.reload(); install();
setInterval(async () => { if (!(document.getElementById('developer-tools') as HTMLDetailsElement).open) return; try { const d = await call('diagnostics'); document.getElementById('timeline')!.textContent = d.timeline.slice(-12).map((e: any) => `${new Date(e.at).toLocaleTimeString()}  ${e.type}\n${e.eventId}`).join('\n\n'); document.getElementById('state')!.textContent = JSON.stringify(d.state, null, 2); } catch {} }, 1000);
