import { EXPERIENCE_BRIDGE_MESSAGE, injectExperienceBridge } from './bridge.js';
import type { GenesisProject } from '../project.js';
import type { GenesisPlayerRequest } from '../participation.js';
const normalizeStageAspectRatio = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= .25 && value <= 4 ? value : 16 / 9;
export interface GenesisBrowserTransport {
  players?(request: GenesisPlayerRequest): Promise<any>;
  read(): Promise<any>; action(eventId: string, actionId: string, data: unknown, revision: number): Promise<any>;
  playback(playbackId: string): Promise<any>; runJob(jobId: string): Promise<any>; skip(jobId: string): Promise<any>; retry(jobId: string): Promise<any>;
}
/** Framework-independent player. Custom code always runs in an opaque sandbox iframe. */
export function mountGenesisPlayer(container: HTMLElement, project: GenesisProject, transport: GenesisBrowserTransport) {
  const nonce = crypto.randomUUID(), root = document.createElement('div'); root.className = 'genesis-player';
  root.innerHTML = '<div class="genesis-stage"><img alt="Current scene"><video playsinline controls></video><div class="genesis-overlay"></div></div><div class="genesis-panel"></div><div class="genesis-controls"></div><p role="status" class="genesis-status"></p>';
  container.replaceChildren(root);
  const stage = root.querySelector<HTMLElement>('.genesis-stage')!, image = root.querySelector<HTMLImageElement>('img')!, video = root.querySelector<HTMLVideoElement>('video')!, overlay = root.querySelector<HTMLElement>('.genesis-overlay')!, panel = root.querySelector<HTMLElement>('.genesis-panel')!, controls = root.querySelector<HTMLElement>('.genesis-controls')!, status = root.querySelector<HTMLElement>('.genesis-status')!;
  stage.style.aspectRatio = String(normalizeStageAspectRatio(project.definition.interface.stageAspectRatio));
  let view: any, destroyed = false, busy = false, sentPlayback = '', startedPlayback = '';
  const frame = project.definition.interface.mode === 'custom' ? document.createElement('iframe') : null;
  if (frame) {
    frame.title = 'Genesis interface'; frame.sandbox.add('allow-scripts'); frame.referrerPolicy = 'no-referrer';
    const source = injectExperienceBridge(project.interfaceSource, nonce, project.definition.inputs.map(i => i.id));
    // The host inserts its CSP first and strips creator CSP declarations.
    const clean = source.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?Content-Security-Policy[^>]*>/gi, '');
    const localAssets = `${location.origin}/assets/`;
    const csp = '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; img-src https: data: ' + localAssets + '; media-src https: ' + localAssets + '; connect-src &#39;none&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;">';
    frame.srcdoc = /<head[^>]*>/i.test(clean) ? clean.replace(/<head([^>]*)>/i, `<head$1>${csp}`) : `<html><head>${csp}</head><body>${clean}</body></html>`;
    (project.definition.interface.placement === 'overlay' ? overlay : panel).append(frame);
    frame.addEventListener('load', () => publish());
  }
  const publish = () => { if (!frame?.contentWindow || !view) return; frame.contentWindow.postMessage({ type: EXPERIENCE_BRIDGE_MESSAGE, v: 1, nonce, op: 'state', view: { ...view, assetSources: { ...Object.fromEntries((project.assets || []).map(a => [a.path, new URL(a.path, location.origin + '/').href])), ...view.assetSources }, stageGeometry: geometry(), stageViewport: { x: 0, y: 0, width: 1, height: 1 } } }, '*'); };
  const geometry = () => {
    const box = stage.getBoundingClientRect(), width = video.videoWidth || image.naturalWidth || 16, height = video.videoHeight || image.naturalHeight || 9;
    const scale = Math.min(box.width / width, box.height / height); return { x: (box.width - width * scale) / (2 * (box.width || 1)), y: (box.height - height * scale) / (2 * (box.height || 1)), width: width * scale / (box.width || 1), height: height * scale / (box.height || 1) };
  };
  image.onload = publish; video.onloadedmetadata = publish;
  const button = (label: string, fn: () => Promise<any>, disabled = false) => { const b = document.createElement('button'); b.textContent = label; b.disabled = disabled || busy; b.onclick = () => void perform(fn); controls.append(b); return b; };
  const render = (next: any) => {
    if (destroyed) return; view = next; const g = view.genesis, playing = g.stage.mode === 'playing';
    const showStage = project.definition.worldVideo.enabled || g.stage.visible === true || g.stage.mode === 'generating' || playing;
    stage.hidden = !showStage; image.hidden = playing; video.hidden = !playing;
    if (g.anchor?.imageUrl && image.getAttribute('src') !== g.anchor.imageUrl) image.src = g.anchor.imageUrl;
    if (playing && (video.getAttribute('src') !== g.stage.videoUrl || startedPlayback !== g.stage.playbackId)) {
      if (video.getAttribute('src') !== g.stage.videoUrl) video.src = g.stage.videoUrl;
      else video.currentTime = 0;
      startedPlayback = g.stage.playbackId; sentPlayback = ''; void video.play().catch(() => {});
    }
    if (!playing) video.pause(); overlay.style.opacity = g.stage.overlays ? '1' : '0'; overlay.style.pointerEvents = g.stage.overlays ? 'auto' : 'none';
    if (frame && project.definition.interface.placement === 'overlay' && !showStage && frame.parentElement !== panel) panel.append(frame);
    else if (frame && project.definition.interface.placement === 'overlay' && showStage && frame.parentElement !== overlay) overlay.append(frame);
    controls.replaceChildren();
    if (view.participation && transport.players) {
      for (const seat of view.participation.seats) button(seat.canRelease ? `Leave ${seat.label}` : seat.actorId ? `${seat.label}: occupied` : `Join ${seat.label}`, () => transport.players!({ operation: seat.canRelease ? 'release' : 'claim', seatId: seat.id }), !seat.canClaim && !seat.canRelease);
      if (view.participation.queueEnabled) button(view.participation.queuePosition ? `Leave queue (#${view.participation.queuePosition})` : 'Join waiting queue', () => transport.players!({ operation: view.participation.queuePosition ? 'queue.leave' : 'queue.join' }), !view.participation.queuePosition && !view.participation.canQueue);
    }
    for (const action of g.actions) {
      if (frame && (project.definition.interface.handledInputBindingIds || []).includes(action.inputBindingId)) continue;
      if (g.window?.options?.length) for (const o of g.window.options) button(o.label, () => act(action.id, { optionId: o.id }), !action.canSubmit);
      else {
        const input = project.definition.inputs.find(i => i.id === action.inputBindingId);
        if (input?.kind === 'text') { const text = document.createElement('input'); text.placeholder = 'Your next action'; text.maxLength = input.maxLength; controls.append(text); button(action.label, () => act(action.id, { text: text.value }), !action.canSubmit); }
        else if (input?.kind === 'click') button('Move forward', () => act(action.id, { x: .5, y: .5, anchorId: g.anchor.id, sceneRevision: g.anchor.revision }), !action.canSubmit);
      }
    }
    for (const job of g.jobs) { if (job.status === 'queued') { button(job.type === 'tool.request' ? 'Run tool' : 'Run scene', () => transport.runJob(job.id)); button('Skip', () => transport.skip(job.id)); } else if (job.status === 'failed') { button('Retry', () => transport.retry(job.id)); button('Skip', () => transport.skip(job.id)); } }
    status.textContent = view.status === 'waiting_players' ? 'Waiting for more players.' : g.stage.mode === 'generating' ? 'Preparing the scene.' : '';
    publish();
  };
  const perform = async (fn: () => Promise<any>) => { if (busy) return; busy = true; try { const next = await fn(); busy = false; render(next); } catch (error: any) { busy = false; status.textContent = error.message || 'The action failed.'; } };
  const act = (actionId: string, data: Record<string, unknown>) => transport.action(crypto.randomUUID(), actionId, { ...data, ...(view.genesis.window?.mode === 'collective' ? { windowId: view.genesis.window.id } : {}) }, view.genesis.revision);
  const receive = async (event: MessageEvent) => {
    const msg = event.data; if (!frame || event.source !== frame.contentWindow || msg?.type !== EXPERIENCE_BRIDGE_MESSAGE || msg.nonce !== nonce || msg.v !== 1 || typeof msg.requestId !== 'string') return;
    if (msg.op === 'players' && transport.players) {
      try { const next = await transport.players(msg.payload); render(next); frame.contentWindow?.postMessage({ type: EXPERIENCE_BRIDGE_MESSAGE, v: 1, nonce, requestId: msg.requestId, result: { accepted: true } }, '*'); } catch (e: any) { frame.contentWindow?.postMessage({ type: EXPERIENCE_BRIDGE_MESSAGE, v: 1, nonce, requestId: msg.requestId, error: e.message }, '*'); } return;
    }
    if (msg.op !== 'genesis_action') { frame.contentWindow?.postMessage({ ...msg, error: 'This local player supports typed Genesis actions.' }, '*'); return; }
    if (!view.genesis.actions.some((a: any) => a.id === msg.bindingId)) { frame.contentWindow?.postMessage({ ...msg, error: 'Use a declared action.' }, '*'); return; }
    try { const next = await act(msg.bindingId, msg.payload); render(next); frame.contentWindow?.postMessage({ ...msg, result: { accepted: true } }, '*'); } catch (e: any) { frame.contentWindow?.postMessage({ ...msg, error: e.message }, '*'); }
  };
  window.addEventListener('message', receive);
  video.onended = () => { const id = view.genesis.stage.playbackId; if (id === sentPlayback) return; sentPlayback = id; void perform(() => transport.playback(id)); };
  let polling = false; const timer = setInterval(async () => { if (polling || busy || destroyed) return; polling = true; try { render(await transport.read()); } catch { status.textContent = 'Reconnecting…'; } finally { polling = false; } }, 1000);
  void transport.read().then(render).catch(e => { status.textContent = e.message; });
  return { refresh: async () => render(await transport.read()), destroy() { destroyed = true; clearInterval(timer); window.removeEventListener('message', receive); video.pause(); container.replaceChildren(); } };
}
