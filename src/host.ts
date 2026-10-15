import { createHash } from 'node:crypto';
import { createExperienceSessionState, joinExperienceParticipant, type ExperienceSessionState } from './experienceSessionCore.js';
import { createGenesisState, genesisView, GenesisRequestError, type GenesisEvent } from './genesisCore.js';
import { dispatchGenesisEvent, submitGenesisAction, tickGenesis, settleGenesisJob, completeGenesisPlayback, retryGenesisJob, requestGenesisPlayer } from './genesisRuntime.js';
import { registerGenesisIdentity, genesisParticipationView, genesisParticipantRole, touchGenesisParticipant, type GenesisPlayerRequest } from './participation.js';
import { defaultGenesisHostPolicy, type GenesisHostPolicy } from './policy.js';
import { validateGenesisProject, type GenesisProject } from './project.js';
import { GenesisProviderSubmissionError, MemoryGenesisStorage, type GenesisProvider, type GenesisStorage, type GenesisSnapshot, type GenesisHostServices, type GenesisTrace } from './adapters.js';

/** One authoritative session. All writes are serialized and persisted before provider work. */
export class GenesisHost {
  readonly project: GenesisProject;
  private state!: ExperienceSessionState;
  private snapshot!: GenesisSnapshot;
  private queue: Promise<unknown> = Promise.resolve();
  private storage: GenesisStorage;
  private policy: GenesisHostPolicy;
  private services: GenesisHostServices;
  private providers: readonly GenesisProvider[];
  constructor(readonly sessionId: string, project: GenesisProject, options: { storage?: GenesisStorage; policy?: GenesisHostPolicy; services?: GenesisHostServices; providers?: readonly GenesisProvider[] } = {}) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(sessionId)) throw new Error('Use a safe session ID.');
    this.project = validateGenesisProject(structuredClone(project)); this.storage = options.storage || new MemoryGenesisStorage();
    this.policy = { ...defaultGenesisHostPolicy, ...options.policy, capabilities: [...(options.policy?.capabilities || defaultGenesisHostPolicy.capabilities)] };
    const media = [this.project.startImageUrl, this.project.coverImageUrl, ...this.project.definition.scenes.flatMap(scene => [scene.imageUrl, scene.videoUrl])];
    if (media.some(url => url && !this.policy.validateAssetUrl(url))) throw new Error('Project media must satisfy the host media policy.');
    this.services = options.services || {}; this.providers = options.providers || [];
    if (this.project.definition.participation.maxPlayers > this.policy.maxPlayers) throw new Error('The project exceeds the host player limit.');
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> { const work = this.queue.then(operation); this.queue = work.catch(() => {}); return work; }
  async initialize() { return this.serial(async () => {
    const projectHash = createHash('sha256').update(JSON.stringify(this.project)).digest('hex');
    const saved = await this.storage.load(this.sessionId);
    if (saved && (saved.version !== 1 || saved.projectHash !== projectHash)) throw new Error('This session pins a different project version. Use a new session ID.');
    this.state = saved?.state || createExperienceSessionState(this.project.definition, projectHash, 431);
    this.snapshot = saved || { version: 1, projectHash, state: this.state, providerJobs: {}, timeline: [] };
    if (!this.state.genesis) { this.state.genesis = createGenesisState(this.project.definition, this.project.startImageUrl); this.state = await this.dispatch({ id: 'session.start', type: 'session.started', data: {}, now: Date.now() }); }
    await this.persist();
    return this;
  }); }
  private async dispatch(event: GenesisEvent) { return dispatchGenesisEvent(this.project.definition, this.state, this.project.controllerSource, event, this.policy); }
  private async persist(type?: string, eventId = '', detail?: string) {
    if (type) this.snapshot.timeline.push({ at: Date.now(), type, eventId, revision: this.state.genesis!.revision, ...(detail ? { detail: detail.slice(0, 240) } : {}) });
    this.snapshot.timeline = this.snapshot.timeline.slice(-200);
    const liveJobs = new Set(this.state.genesis!.jobs.map(job => job.id)); for (const id of Object.keys(this.snapshot.providerJobs)) if (!liveJobs.has(id)) delete this.snapshot.providerJobs[id]; this.snapshot.state = this.state;
    await this.storage.save(this.sessionId, this.snapshot);
  }
  view(actorId: string) {
    const actor = this.state.participants.find(p => p.id === actorId); if (!actor) throw new GenesisRequestError('Join the session first.');
    const genesis = genesisView(this.project.definition, this.state.genesis!, actorId, genesisParticipantRole(this.state, actor), this.policy);
    if (this.state.status !== 'active') genesis.actions = genesis.actions.map(a => ({ ...a, canSubmit: false }));
    return { actorId, participation: genesisParticipationView(this.project.definition, this.state, actorId), participants: this.state.participants.map(({ id, name, role }) => ({ id, name, role })), status: this.state.status, inputs: this.project.definition.inputs.map(i => ({ ...i, canSubmit: genesis.actions.some(a => a.inputBindingId === i.id && a.canSubmit) })), phaseId: this.state.phaseId, round: Number(genesis.state.turn || 0) + 1, genesis };
  }
  diagnostics(): { state: ExperienceSessionState; timeline: GenesisTrace[] } { return structuredClone({ state: this.state, timeline: this.snapshot.timeline }); }
  async join(actorId: string, name: string, role: 'player' | 'spectator' = 'player', identityKey = actorId) { return this.serial(async () => {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(actorId) || ['__proto__', 'prototype', 'constructor'].includes(actorId) || !name.trim() || name.length > 60) throw new GenesisRequestError('Use a valid participant ID and name.');
    const existed = this.state.participants.some(p => p.id === actorId);
    this.state = joinExperienceParticipant(this.project.definition, this.state, { id: actorId, name, role, characterId: '', joinedAt: Date.now(), lastSeenAt: Date.now() });
    registerGenesisIdentity(this.state, actorId, identityKey);
    if (!existed) this.state = await this.dispatch({ id: `join:${actorId}:${this.state.revision}`, type: 'participant.joined', actorId, data: {}, now: Date.now() });
    await this.persist('participant.joined', actorId); return this.view(actorId);
  }); }
  async leave(actorId: string) { return this.serial(async () => {
    if (this.state.participation) {
      this.state = await tickGenesis(this.project.definition, this.state, this.project.controllerSource, Date.now(), this.policy);
      for (const seat of this.state.participation!.seats.filter(s => s.actorId === actorId)) this.state = await requestGenesisPlayer(this.project.definition, this.state, this.project.controllerSource, actorId, { operation: 'release', seatId: seat.id }, Date.now(), this.policy);
      this.state.participation!.queue = this.state.participation!.queue.filter(id => id !== actorId); delete this.state.participation!.identities[actorId];
    }
    this.state = structuredClone(this.state); this.state.participants = this.state.participants.filter(p => p.id !== actorId);
    this.state.status = this.state.participants.filter(p => p.role === 'player').length >= this.project.definition.participation.minPlayers ? 'active' : 'waiting_players';
    this.state = await this.dispatch({ id: `leave:${actorId}:${this.state.revision}`, type: 'participant.left', actorId, data: {}, now: Date.now() }); await this.persist('participant.left', actorId);
  }); }
  /** actorId and identityKey are supplied by authenticated host middleware. */
  async players(actorId: string, request: GenesisPlayerRequest) { return this.serial(async () => {
    const next = await requestGenesisPlayer(this.project.definition, touchGenesisParticipant(this.state, actorId), this.project.controllerSource, actorId, request, Date.now(), this.policy);
    this.state = next; await this.persist('participation.request', actorId, request.operation); return this.view(actorId);
  }); }
  async read(actorId: string) { return this.serial(async () => {
    this.state = await tickGenesis(this.project.definition, touchGenesisParticipant(this.state, actorId), this.project.controllerSource, Date.now(), this.policy);
    await this.persist(); return this.view(actorId);
  }); }
  async action(actorId: string, eventId: string, actionId: string, payload: unknown, revision: number) { return this.serial(async () => {
    if (this.services.moderateAction && !await this.services.moderateAction({ actorId, actionId, payload })) throw new GenesisRequestError('This action was declined by the host.');
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(eventId)) throw new GenesisRequestError('Use a valid action event ID.');
    if (this.state.genesis!.receipts.includes(eventId)) return this.view(actorId);
    this.state = await submitGenesisAction(this.project.definition, touchGenesisParticipant(this.state, actorId), this.project.controllerSource, actorId, eventId, actionId, payload, revision, Date.now(), this.policy);
    await this.persist('action.accepted', eventId, actionId); return this.view(actorId);
  }); }
  async playback(actorId: string, playbackId: string) { return this.serial(async () => { this.state = await completeGenesisPlayback(this.project.definition, touchGenesisParticipant(this.state, actorId), this.project.controllerSource, actorId, playbackId, Date.now(), this.policy); await this.persist('playback.completed', playbackId); return this.view(actorId); }); }
  async runJob(actorId: string, jobId: string) { return this.serial(async () => {
    if (genesisParticipantRole(this.state, this.state.participants.find(p => p.id === actorId)) !== 'player') throw new GenesisRequestError('Only players can run tools.');
    const job = this.state.genesis!.jobs.find(j => j.id === jobId); if (!job || job.status !== 'queued') return this.view(actorId);
    const provider = this.providers.find(p => p.capabilities.includes((job.effect.type === 'tool.request' ? job.effect.toolId : job.effect.type) as any)); if (!provider) throw new GenesisRequestError('The host has no provider for this tool.');
    if (provider.validate && !await provider.validate(structuredClone(job))) throw new GenesisRequestError('The host tool rejected these arguments.');
    const existingHandle = this.snapshot.providerJobs[jobId];
    if (existingHandle) {
      this.state = structuredClone(this.state); this.state.genesis!.jobs.find(j => j.id === jobId)!.status = 'running'; await this.persist('job.resumed', jobId); return this.view(actorId);
    }
    if (provider.paid && (!this.services.authorizeTool || !await this.services.authorizeTool({ sessionId: this.sessionId, actorId, job: structuredClone(job), provider }))) throw new GenesisRequestError('The host must authorize paid generation.');
    this.state = structuredClone(this.state); const current = this.state.genesis!.jobs.find(j => j.id === jobId)!; current.status = 'running';
    await this.persist('job.started', jobId, provider.id);
    try {
      const started = await provider.start({ sessionId: this.sessionId, job: structuredClone(current), anchor: structuredClone(this.state.genesis!.anchors[current.effect.anchorId || this.state.genesis!.stage.anchorId]), idempotencyKey: `${this.sessionId}:${jobId}` });
      if (!provider.paid) this.state.genesis!.reservedCostUsd = Math.max(0, Math.round((this.state.genesis!.reservedCostUsd - current.maxCostUsd) * 10000) / 10000);
      this.snapshot.providerJobs[jobId] = { providerId: provider.id, id: started.id }; await this.persist('job.submitted', jobId);
    } catch (error) { const uncertain = provider.paid && !(error instanceof GenesisProviderSubmissionError && !error.ambiguous); this.state.genesis!.jobs.find(j => j.id === jobId)!.submissionUncertain = uncertain; this.state = await settleGenesisJob(this.project.definition, this.state, this.project.controllerSource, jobId, { error: uncertain ? 'Provider submission is uncertain. Ask the host to reconcile it before retrying.' : 'The provider could not start this job.' }, Date.now(), this.policy); await this.persist('job.failed', jobId); }
    return this.view(actorId);
  }); }
  async tick(now = Date.now()) { return this.serial(async () => {
    this.state = await tickGenesis(this.project.definition, this.state, this.project.controllerSource, now, this.policy);
    for (const job of this.state.genesis!.jobs.filter(j => j.status === 'running')) {
      const handle = this.snapshot.providerJobs[job.id];
      if (!handle) { this.state.genesis!.jobs.find(j => j.id === job.id)!.submissionUncertain = true; this.state = await settleGenesisJob(this.project.definition, this.state, this.project.controllerSource, job.id, { error: 'Provider submission was interrupted. Check provider history before retrying.' }, now, this.policy); continue; }
      const provider = this.providers.find(p => p.id === handle.providerId); if (!provider) continue;
      let status: Awaited<ReturnType<GenesisProvider['poll']>>;
      try { status = await provider.poll(handle.id, structuredClone(job)); }
      catch { await this.persist('job.poll.failed', job.id, 'Provider polling will resume.'); continue; }
      if (status.status === 'running') continue;
      if (status.result?.data && JSON.stringify(status.result.data).length > 12000) { status.status = 'failed'; status.result = { error: 'The tool result exceeds its data limit.' }; }
      if (status.status === 'ready' && job.effect.type !== 'tool.request' && (!status.result?.imageUrl || !this.policy.validateAssetUrl(status.result.imageUrl) || job.effect.type === 'scene.request' && (!status.result.videoUrl || !this.policy.validateAssetUrl(status.result.videoUrl)))) { status.status = 'failed'; status.result = { error: 'The provider must return valid saved media and an actual final-frame checkpoint.' }; }
      try {
        this.state = await settleGenesisJob(this.project.definition, this.state, this.project.controllerSource, job.id, status.status === 'failed' ? { error: status.result?.error || 'Provider failed.' } : status.result || { error: 'Provider returned no result.' }, now, this.policy);
        await this.persist(`job.${status.status}`, job.id);
      } catch (error: any) {
        this.state = structuredClone(this.state); const current = this.state.genesis!.jobs.find(j => j.id === job.id)!;
        current.status = 'failed'; current.error = String(error.message || 'The controller could not process this result.').slice(0, 240);
        if (job.effect.type !== 'tool.request' && this.state.genesis!.stage.ownerJobId === job.id) { this.state.genesis!.stage.mode = 'holding'; this.state.genesis!.stage.ownerJobId = ''; }
        this.state.genesis!.revision++; this.state.revision++; await this.persist('controller.failed', job.id, current.error);
      }
    }
    await this.persist();
  }); }
  /** Operator-only recovery. Never expose this method to creator actions or participant routes. */
  async reconcileProviderJob(jobId: string, providerId: string, predictionId: string) { return this.serial(async () => {
    const provider = this.providers.find(p => p.id === providerId), job = this.state.genesis!.jobs.find(j => j.id === jobId);
    if (!provider || !job?.submissionUncertain || job.status !== 'failed' || this.state.genesis!.jobs.some(j => ['queued', 'running'].includes(j.status)) || !predictionId || predictionId.length > 4096) throw new GenesisRequestError('Choose an uncertain job and a verified provider handle.');
    this.state = structuredClone(this.state); const current = this.state.genesis!.jobs.find(j => j.id === jobId)!; current.status = 'running'; current.error = ''; current.submissionUncertain = false; current.retryCount++;
    if (job.effect.type !== 'tool.request') { this.state.genesis!.stage.mode = 'generating'; this.state.genesis!.stage.ownerJobId = jobId; this.state.genesis!.stage.overlays = false; }
    this.snapshot.providerJobs[jobId] = { providerId, id: predictionId }; await this.persist('job.reconciled', jobId);
  }); }
  async retry(actorId: string, jobId: string) { return this.serial(async () => { if (genesisParticipantRole(this.state, this.state.participants.find(p => p.id === actorId)) !== 'player') throw new GenesisRequestError('Only players can retry jobs.'); if (this.state.genesis!.jobs.find(j => j.id === jobId)?.submissionUncertain) throw new GenesisRequestError('Reconcile the provider submission before retrying.'); this.state = retryGenesisJob(this.state, jobId); await this.persist('job.retry', jobId); return this.view(actorId); }); }
  async skip(actorId: string, jobId: string) { return this.serial(async () => {
    if (genesisParticipantRole(this.state, this.state.participants.find(p => p.id === actorId)) !== 'player') throw new GenesisRequestError('Only players can skip jobs.');
    const job = this.state.genesis!.jobs.find(j => j.id === jobId); if (!job || !['queued', 'failed'].includes(job.status)) throw new GenesisRequestError('Skip a queued or failed job.');
    this.state = structuredClone(this.state); const current = this.state.genesis!.jobs.find(j => j.id === jobId)!;
    if (current.status === 'queued' && !this.snapshot.providerJobs[jobId]) this.state.genesis!.reservedCostUsd -= current.maxCostUsd;
    current.status = 'cancelled'; if (job.effect.type !== 'tool.request') { this.state.genesis!.stage.ownerJobId = ''; this.state.genesis!.stage.mode = 'holding'; }
    this.state = await this.dispatch({ id: `skip:${jobId}`, type: 'job.skipped', data: { jobId }, now: Date.now() }); await this.persist('job.skipped', jobId); return this.view(actorId);
  }); }
}
