import { mountGenesisPlayer } from '/browser/player.js';

const form = document.getElementById('login');
const message = document.getElementById('message');
let token = '', player;
const call = async (path, input) => {
  const response = await fetch(path, {
    method: input === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The room request failed.');
  return result;
};
form.onsubmit = async event => {
  event.preventDefault();
  form.querySelector('button').disabled = true;
  token = document.getElementById('token').value.trim();
  try {
    await call('/api/join', {});
    const { project, fixtures } = await call('/project');
    document.getElementById('title').textContent = project.title;
    message.textContent = fixtures ? 'Prepared fixtures. Battle rules run on the server; live video directions are simulated.' : 'Connected to the shared world.';
    player?.destroy();
    player = mountGenesisPlayer(document.getElementById('player'), project, {
      read: () => call('/api/view'),
      players: request => call('/api/players', request),
      action: (eventId, actionId, data, revision) => call('/api/action', { eventId, actionId, data, revision }),
      playback: playbackId => call('/api/playback', { playbackId }),
      runJob: jobId => call('/api/run', { jobId }), retry: jobId => call('/api/retry', { jobId }), skip: jobId => call('/api/skip', { jobId }),
    });
    document.getElementById('token').value = '';
    form.hidden = true;
    document.getElementById('leave').hidden = false;
  } catch (error) { message.textContent = error.message; }
  finally { form.querySelector('button').disabled = false; }
};
document.getElementById('leave').onclick = async () => {
  try {
    await call('/api/leave', {});
    player?.destroy(); player = null; token = '';
    form.hidden = false;
    document.getElementById('leave').hidden = true;
    message.textContent = 'You left the world. Enter a player token to reconnect.';
  } catch (error) { message.textContent = error.message; }
};
