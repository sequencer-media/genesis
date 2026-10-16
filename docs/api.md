# Genesis 0.1 API

### Delivery policy and latency targets

Controllers choose delivery policy before the host asks an LLM to write the next visual prompt:

```js
{ id: 'send-out:17', type: 'live.direction', intent: 'Show the committed send-out once.',
  delivery: { priority: 'urgent', replaceable: false, targetLatencyMs: 5000 },
  frameMode: 'new-frame', frameRef: { key: 'lineup', fingerprint: 'red:6,blue:9' } }
```

`delivery.priority` is `urgent`, `queued`, or `mergeable`. Urgent takes the next available dispatch slot in FIFO order among urgent requests. It cancels only work explicitly marked `replaceable:true` that has not begun playback. Earlier urgent jobs, protected running jobs, displayed footage and committed controller outcomes retain their authority. Queued is the default and is protected unless the controller explicitly marks it replaceable. Mergeable requires a bounded `mergeKey` and defaults to replaceable. Existing `queue:true` directions retain their FIFO behavior.

The deterministic scheduler combines compatible, unstarted mergeable live directions before provider submission. The type, model, frame references, continuity, guard, duration and replacement policy must match. A batch contains at most eight original effects and a combined intent under 4,000 characters and complete combined outcomes under 3,600 JSON characters. Oversized outcomes remain separate jobs so prompt compaction cannot drop their facts. Each original ID and required outcome is retained in `job.mergedEffects`; the provider receives `requiredOutcome.mergedOutcomes`. The single completion event includes `mergedEffectIds`. Controllers opt into this contract for compatible visual instructions and keep game outcomes authoritative. Submitted work is never merged retroactively.

`frameMode:'continue'` uses the actual preceding frame (`continuity:'linked'`). `new-frame` uses an accepted `anchorId` or exact prepared `frameRef` (`continuity:'reanchor'`). A missing or stale prepared frame follows the frame library's linked fallback and requests a refresh. `text-to-video` is for standalone `scene.request` effects, omits frame references and compiles to `useStartFrame:false`. Precompute likely start images through `frame.prepare` so urgent delivery can reuse a ready frame rather than wait for image generation.

`targetLatencyMs` is an advisory playback target from 1,000 to 120,000 ms. Optional `selectedAtMs` records the trusted server selection timestamp before a shared lock-in barrier; it must be a positive integer at or before the current event. With no explicit selection time, admission time is used. A value of 5,000 means aim to begin playback five seconds after selection (or admission when no selection time was recorded). It does not guarantee generation or delivery in exactly five seconds. The public queue exposes `priority`, `targetLatencyMs`, `targetStartAt`, `targetStatus` (`unknown`, `on-track`, `at-risk`, `missed`, `playing`) and `mergedEffectIds`, independently of the observed/estimated playback ETA. Never display a target as a confirmed countdown. A reusable saved idle clip can cover waiting time without generating more queued filler or inventing game progress.

`genesisDispatchOrder(state)` is the host-side executable ordering helper. `GenesisHost` automatically dispatches an eligible urgent job after an action and on tick. Hosts cancel superseded provider handles where supported and ignore every late result from a cancelled job. A provider without interruption support may finish discarded work in the background while urgent work starts. An unsubmitted job releases its reservation once. A submitted paid job releases its spend reservation only when `provider.cancel()` explicitly returns `{refunded:true}`. A cancellation request alone establishes no refund.

## Project

`GenesisProject` has format `genesis-project`, version 1, title, optional description, coverImageUrl and namespaced extensions, definition, interfaceSource, controllerSource and startImageUrl. `validateGenesisProject()` validates the versioned JSON Schema and semantic references, then normalizes the project. Unknown product settings and host policies are rejected. `coverImageUrl` is listing art; `startImageUrl` initializes the scene checkpoint. `createGenesisProject(template)` returns a runnable starter. Local media uses /assets paths; external media uses HTTPS. A hosting adapter may narrow allowed media hosts.

File-based projects keep settings in `genesis.json` with `interfaceFile: "interface.html"` and `controllerFile: "controller.js"`. `createGenesisProjectManifest(project)` produces this source-free manifest. `applyGenesisProjectManifest(manifest, interfaceSource, controllerSource)` validates editor settings without replacing the opened code. `loadGenesisProject(directory)` loads referenced source files with directory containment checks. The schema accepts manifests and inline transport projects. `exportGenesisProjectArchive(project)` produces a ZIP with the three entry files and genesis.schema.json; `importGenesisProjectArchive(bytes)` validates and restores it with bounded extraction. `importGenesisProjectText(text)` accepts an inline JSON transport project. Media files remain references.

`definition.worldVideo.chunkIntervalSeconds` defaults to 14 and accepts numbers from 2 to 30, including fractional seconds. It is a requested continuous-stream cadence, separate from `scene.request.duration`. It reaches `context.config.video.chunkIntervalSeconds`. Sequencer snaps continuous FastH3 requests from 5 to 15 seconds to the nearest measured size (124/24, 243/24, or 345/24 seconds), stores the exact duration and displays two decimal places. Hosts must validate supported intervals before admission and configure the provider; the runtime does not resample provider video or override a fixed provider cadence.

`definition.interface.stageAspectRatio` controls the media stage's width divided by height. It defaults to 16/9 (1.7777777777777777) and accepts numbers from 0.25 to 4, including portrait 9/16 (0.5625), square (1), and custom ratios. Players contain media within that shape and preserve frame coordinates through letterboxing. This presentation preference does not change the generation provider's output dimensions. Custom overlay interfaces use the stage shape; panel interfaces retain their own layout.

`definition.genesis.configSchema` maps setting IDs to primitive fields. Each declares type (string, number or boolean), label, default, optional description, numeric min/max, maxLength or an options array of {value,label}. `config` holds validated values. Controllers read `config.settings`. These settings are public and must contain no secrets. genesis.worldPrompt is server context and is removed from public definitions. initialState becomes public controller state; initialize private/server state in the controller.

## Controller

Define classic JavaScript `function onEvent(context)`. The context includes state {public, private, server, window}, event {id,type,actorId?,actionId?,data,now}, participants, a server-only ballots snapshot, stage, anchors and config. It contains no host credential or wallet objects.

Return an object with optional public/private/server state, window and effects. State updates replace their corresponding object. A window declares id, actionIds, mode (individual or collective), optional actorIds, choices and deadline. An empty actorIds array grants no actor permission. Collective windows require 2 to 12 choices. Window IDs must change between decisions. Choice and ballot payloads carry optionId; the browser SDK includes the current collective windowId.

Events include session.started, participant.joined, participant.left, action, vote.cast, vote.resolved, vote.empty, timer, job.ready, job.failed, job.skipped and playback.completed. Generation completion describes prepared media. Playback completion means the host's participant policy has been satisfied.

Effects: scene.request, image.request, live.direction, tool.request, stage.show, stage.restore, stage.play and timer.set. Each has a unique id. Tool effects carry intent, optional anchorId, modelId, duration, requiredOutcome and maxCostUsd. Timers carry delayMs and data. Stage play carries a saved videoUrl. A restored anchor preserves controller scores and inventory.

Tools must be requested in the manifest and granted by the host. Stream defaults do not restrict operations in custom controllers. A provider still must implement the requested capability. The default controller uses stream defaults to choose its behavior.

## Browser SDK

`window.Genesis.action(id,data)` sends an action. `actions.get(id)` and `actions.list()` describe current permissions. `state.get()` returns public state; `state.subscribe(fn)` receives updates. `stage.get()` returns presentation and anchor data. `stage.point(event,element)` returns normalized frame coordinates accounting for letterboxing. `on('state',fn)` receives the filtered view. The existing image, voice and character helpers depend on host support; the standalone reference player currently supports typed actions and standard text/click/choice controls.

State subscriptions begin when the host supplies the first view. They receive the current view immediately when registered after that point. Initialize UI placeholders in HTML, and read player seats and game state inside a subscription.

Custom interfaces execute inside opaque sandbox iframes. Their content policy blocks network APIs such as fetch and WebSocket, while allowing HTTPS images and media and the host's local asset paths. This permits outbound media requests and is not complete network isolation. Production hosts must restrict media destinations and iframe navigation with their own content security policy and keep secrets outside interface views. The local runner restricts iframe navigation to its own origin. The host remains responsible for essential exit, reconnect and billing UI. Host-message handling checks the frame source, nonce and declared action.

## Node host and adapters

The [MCP adapter](mcp.md) exposes typed project actions, image caching, frame preparation, live start-frame changes and other runtime effects. Import `createGenesisMcpServer` from `@genesis-worlds/runtime/mcp`. Operator controls remain in the trusted server scope.


Run the [small server example](hosting.md) for a persistent room with authenticated players, a background worker and the browser player.

Construct GenesisHost(sessionId,project,{storage,policy,services,providers}), then await initialize(). Methods: join, leave, view, action, playback, runJob, tick, retry and skip. diagnostics() is author-only and includes internal state. Never expose it to general participants.

Providers implement id, paid, capabilities, start, poll and optional cancel. Start receives a stable idempotencyKey, a job and anchor. Poll returns running, ready or failed. Ready scene results include videoUrl and an actual end-frame imageUrl. Storage implements load/save snapshots. The reference host serializes per-session operations in one process; distributed hosts provide their own transaction/lease adapter.

## Custom tools

### Grouped shot planning

Keep a generated shot's overview and style concise. Group each subject or team with its appearance, associated trainer or companion, screen position and actual opening state in one paragraph. Describe the shared camera and environment once, then show the accepted action chronologically from onset through development to its final state. An absent subject stays absent until its authorized entrance. Use only supplied dialogue when the controller owns speech. The controller owns game outcomes, identities, sides and action order; an LLM can phrase their presentation within those facts. Validate bounded model output and retain an authoritative fallback when it is missing, invalid or late.

Genesis remains provider-neutral. A host using H3 assembles `integrated_multimodal_description`, `overall_soundscape` and `non_diegetic_music`. Keep dialogue in the shot timeline and physical sound summaries in the soundscape. Add H3's Picture 1 first-frame instruction only when an actual starting image is supplied. Text-to-video begins directly with the three fields. These provider formatting choices belong in the host adapter and do not add manifest keys or controller authority.

`image.request` accepts `presentation:"background"` to keep the current video and controls visible during generation. Use `referenceAnchorIds` (up to four accepted anchors) to retain style or character references alongside `anchorId`. Completion supplies an immutable anchor in `job.ready`; pass it directly to a reanchor direction without changing the displayed stage. Scene start frames contain physical scenery and characters, with no HUD or UI. Use a separate scene-only image prompt instead of inheriting video presentation instructions. Guards discard obsolete images after a roster or scene change.

`live.direction` and `scene.request` accept `continuity:"linked"|"reanchor"`. Linked delivery continues from the previous shot's actual final frame. Reanchor requires an accepted `anchorId` and installs that image once at the next available generation boundary. Choose linked continuity for a coherent continuation, or reanchor from a prepared frame for an intentional cut. A hosted continuous world can request automatic setup images with `genesis.config.visualContext:true`; the host independently authorizes this mode, the payer, model and declared spending limits. Image preparation is asynchronous, and its completion does not mean video playback has completed.

`scene.request` also accepts `useStartFrame:false` for a new standalone text-to-video concept, such as a five-second battle intro. Omit anchorId, referenceAnchorIds and continuity in this mode. Providers receive no starting anchor, and the hosted generator omits sourceImageUrl. Continuous live.direction actions remain linked or explicitly reanchored.

Generate start frames for material composition changes, such as a different character lineup, fainting pose, battle opening or location. Moves and items can continue the preceding shot or cut to a ready scene-only frame when their delivery policy calls for a new composition. Plan likely future checkpoints early with the frame library, rather than waiting for their trigger.

### Prepared frame library

Controllers and LLM-backed planners can return `{id,type:"frame.prepare",frame:{key,fingerprint,ttlMs:180000,priority:90},anchorId:"start",referenceAnchorIds:["start"],modelId,intent,requiredOutcome,maxCostUsd:.05,guard:{key:"cast",value:castId}}`. This requires the existing `image.request` capability and host grant. It creates a background wishlist entry and admits one image at a time, alongside a live direction. Preparation never changes the displayed stage or commits the predicted game outcome. High priorities run first; a full spend budget leaves remaining entries pending without blocking actions.

`context.frameLibrary` exposes server-only readiness, fingerprint, anchor, expiry and error metadata. Up to 16 entries are retained. Keys are safe IDs up to 64 characters; fingerprints contain up to 512 characters and must cover cast, physical pose, setting, camera and style. TTL is 30 seconds to 24 hours. `frame.invalidate` with `frameKey` marks an entry obsolete. A new fingerprint replaces the forecast, and late results from the old generation cannot replace it. Expired desired frames regenerate through the same budgeted queue. Failed requests have a bounded retry count.

At the actual event, add `frameRef:{key,fingerprint}` to `live.direction` or `scene.request`. An exact, unexpired, ready frame becomes a single reanchor. Missing frames fall back to linked video while preparation continues. Never attach a post-event pose to the attack that causes it: for example, use a fainted checkpoint after the knockout's observed playback completes. A `job.ready` frame result includes `event.data.frameKey` and `frameFingerprint`; readiness alone does not authorize insertion.

The reference host automatically starts prepared image jobs on `tick`, subject to provider authorization. Shared session storage preserves the library. Sequencer also stores exact-input frames by workspace and world across sessions, deduplicates concurrent preparation with leases and stable provider request IDs, and regenerates expired or explicitly refreshed frames. Changes to prompts, model, references, style or content policy produce separate cache keys. Internal frames stay out of participant job controls and never appear as still-image overlays.

For an LLM planner, request a bounded `tool.llm.generate` plan once when the encounter or scene dependencies change. Validate its proposed checkpoints in the controller, guard the result by encounter/scene ID, and emit `frame.prepare` effects within the host's budget. Keep battle outcomes deterministic and independent of the planner. Fixed game states such as two possible knockout poses can use deterministic forecasts without an LLM call on the action path.

`stage.show` accepts `presentation:"preview"` for projects that explicitly need a visible still-image preview. It is not required for a reanchor and should not be used for internal scene start frames.

Request namespaced capabilities such as tool.lookup in the manifest. The host must independently grant the capability and register a provider with that capability. Controllers emit `{id,type:"tool.request",toolId:"tool.lookup",data:{...}}`. Arguments and returned result.data are bounded to 12 KB. Provider validate(job) rejects invalid arguments before paid authorization. Completion enters job.ready with event.data.data. Generic tools preserve the stage; the controller decides presentation. No provider credential or unrestricted fetch capability enters the sandbox.

Collective submissions emit vote.cast with actorId and optionId. Controllers can inspect context.ballots to implement weights, quorum, early resolution or custom aggregation. Returning window:null closes the decision. The standard controller keeps deadline aggregation.

## Portable project boundary

The JSON Schema is exported as GENESIS_PROJECT_SCHEMA. `createGenesisProjectManifest` clears hosted package versions and saved-game connections without mutating the source definition. Inline source remains confined to transport projects. The Worldstreams editor preserves host references separately when applying manifest edits. `definition.interface.chat` optionally requests `{presentation:"minimized"|"open"|"disabled",reactions:boolean}`. Chat access and enforcement stay with the host. `extensions` uses namespaced keys such as `org.example`, up to 16 namespaces and 16 KB total. Unknown extension data is preserved without execution or capability grants.

## Participation version 1

For explicitly claimed seats, declare `definition.participation.seats` as `{version:1,slots:[{id,label}],queue:true,maxSeatsPerIdentity:1}`. Seats require multiplayer mode and spectators, with minPlayers no greater than the slot count and slots no greater than maxPlayers. Slot IDs are unique. Defaults are queue false and one seat per verified identity. Configure `room` as shared or private; room discovery is implemented by the hosting adapter. Sequencer defaults seat worlds to one shared public arena per published version. Continuous worlds always share their audience room. Ordinary projects without seats retain their admission behavior.

For same-account testing, set `maxSeatsPerIdentity:2`. Claiming a second seat creates a distinct controlled actor under the same verified identity. Claiming an occupied seat with `canControl:true` switches that connection to the owned actor. The host moves only that connection's credential, preserves the two fighters and renews both seats while the account is active. Another identity cannot switch into an occupied seat.

`Genesis.players.get()` and `subscribe(fn)` expose version, capabilities, seats with actorId/canClaim/canRelease, queueLength, own queuePosition/canQueue, and own cooldownUntil. `claim(seatId)`, `leave(seatId)`, `joinQueue()` and `leaveQueue()` request server transitions. A browser cannot specify another actor, a role, lease, identity, cooldown or removal authority. The host injects the verified identity. Sequencer requires sign-in to claim or queue. Watchers can remain anonymous.

Controller context.participation contains public seats and queueLength, with no identities or credentials. Events are seat.claimed, seat.released, queue.joined and queue.left. To release a defeated player, return `{id,type:"players.release",seatId,expectedActorId,cooldownMs:5000}`. Expected ownership is checked before commit; the cooldown is limited to 60 seconds and follows the identity across new actor IDs. Replacements are promoted atomically from the eligible FIFO queue. Actions still use ordinary window.actorIds and typed fields, keeping game-specific turns, teams and health in the controller.

Host methods `players(actorId,request)` and `read(actorId)` serialize and persist transitions. Host `join(actorId,name,role,identityKey)` must receive actorId and a stable identityKey from authenticated server middleware. The actor-ID fallback is for trusted local previews. The 45-second seat lease is renewed by read/action traffic at most every 15 seconds; a late heartbeat cannot revive an expired seat. Distributed hosts can use the exported participation reducers and requestGenesisPlayer inside their own transaction. Never expose host.join, diagnostics, identity registration, releaseGenesisSeat or controller dispatch as participant-controlled endpoints.

The arena starter demonstrates two seats, four moves, health, inventory, waiting spectators, defeat cooldown and replacement. Its animate setting defaults false for charge-free rule testing. Enable animate and configure a generation provider to render committed battle outcomes. Browser UI code stays in interface.html and game rules stay in controller.js.

## Structured LLM and asset helpers

Tool tool.llm.generate accepts `{prompt,context?,responseSchema}` with a bounded object schema. Completion emits job.ready with event.data.data. Effect guard `{key,value}` must match current server state before a result is applied; obsolete jobs emit job.cancelled without exposing their result. Controllers receive jobs metadata for scheduling, including status, type and guard.

Genesis.assets.get(path) resolves host-provided media sources. Portable bundles use declared assets/ paths; Sequencer interfaces use asset:// IDs after attachment. `importGenesisProjectBundle` preserves complete assetFiles; importGenesisProjectArchive returns only the project for compatibility.

## Standard action queue

Every participant view includes `genesis.queue`. Browser interfaces opt in through `Genesis.queue.get()` or `Genesis.queue.subscribe(renderQueue)`. The standalone server also exposes authenticated `GET /api/queue`; agents use `genesis_read_queue` through MCP.

The version 1 object contains `version`, `revision`, `serverNow`, `estimated` and ordered `items`. Each item supplies `id`, `jobId`, `actionId`, `kind`, `source` (`action` or `genesis`), `chunkSequence`, `label` (the display nickname), `prompt`, `position`, `status`, `queuedAt`, `durationMs`, `estimatedStartAt`, `estimatedEndAt` and `estimatedWaitMs`. Status is `queued`, `preparing` or `playing`. Times use Unix milliseconds. Estimates use observed playback when available and stay `null` when unavailable or overdue. `estimatedStartAt` is the expected moment the chunk begins playing in the feed, including earlier buffered chunks and queued actions. It is separate from generation completion. Compare timestamps with `serverNow` plus local elapsed time to account for client clock differences. Only observed playback changes status to `playing`. Unknown or stalled timing remains `null`, and interfaces should show the current status until a fresh estimate arrives.

Authors set an effect's `label` and `displayPrompt` for public display. `prompt` contains that explicit public text; internal generation intents and private inputs remain on the server. Background frame preparation stays in the frame library.

A controller can also return `queuePlan:[{id,label,prompt,actionId,jobId,durationMs}]` for committed future actions that have no generation job yet. Replace the complete plan on changes, and clear it with `[]`. Match `id` to a real job ID or set `jobId` to link one. The host merges planned entries with current jobs, supplies ordering and clocks, and removes completed linked jobs. Publish private player choices after the controller commits their reveal. Queue plans permit up to 32 entries and 24 KB; labels allow 100 characters and public prompts allow 2,000.

```js
Genesis.queue.subscribe(queue => {
  const list = document.getElementById('queue');
  list.replaceChildren();
  for (const item of queue.items) {
    const row = document.createElement('li');
    const eta = item.estimatedWaitMs == null ? ''
      : ` (~${Math.ceil(item.estimatedWaitMs / 1000)}s)`;
    row.textContent = `${item.position}. ${item.label}: ${item.status}${eta}`;
    row.title = item.prompt || '';
    list.append(row);
  }
});
```

Idle scene planners should vary environmental details and small gestures using recent history and the chunk sequence. Accepted actions retain priority. In games, idle exploration preserves the cast, camera, health, inventory and results.

Every observed playing or buffered stream chunk belongs in the queue, including automatic Genesis continuation. Hosts supply trusted `GenesisStreamChunk` observations through `genesisQueueView(...,{chunks})` or `services.streamQueue()` on GenesisHost. Include a stable per-chunk ID, sequence, public label/prompt, status, durationMs and estimatedStartAt. Set jobId to merge a chunk with its committed action once. The queue orders chunks and future actions together and preserves actual playback timing. Keep raw generation constraints private and provide separate public display text.
