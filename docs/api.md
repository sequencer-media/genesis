# Genesis 0.1 API

## Project

`GenesisProject` has format `genesis-project`, version 1, title, optional description, coverImageUrl and namespaced extensions, definition, interfaceSource, controllerSource and startImageUrl. `validateGenesisProject()` validates the versioned JSON Schema and semantic references, then normalizes the project. Unknown product settings and host policies are rejected. `coverImageUrl` is listing art; `startImageUrl` initializes the scene checkpoint. `createGenesisProject(template)` returns a runnable starter. Local media uses /assets paths; external media uses HTTPS. A hosting adapter may narrow allowed media hosts.

File-based projects keep settings in `genesis.json` with `interfaceFile: "interface.html"` and `controllerFile: "controller.js"`. `createGenesisProjectManifest(project)` produces this source-free manifest. `applyGenesisProjectManifest(manifest, interfaceSource, controllerSource)` validates editor settings without replacing the opened code. `loadGenesisProject(directory)` loads referenced source files with directory containment checks. The schema accepts manifests and inline transport projects. `exportGenesisProjectArchive(project)` produces a ZIP with the three entry files and genesis.schema.json; `importGenesisProjectArchive(bytes)` validates and restores it with bounded extraction. `importGenesisProjectText(text)` accepts an inline JSON transport project. Media files remain references.

`definition.worldVideo.chunkIntervalSeconds` defaults to 14 and accepts whole seconds from 2 to 30. It is a nominal continuous-stream cadence, separate from `scene.request.duration`. It reaches `context.config.video.chunkIntervalSeconds`. Hosts must reject unsupported intervals before admission and configure the provider; the runtime does not resample provider video or override a fixed provider cadence.

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

Custom interfaces execute inside opaque sandbox iframes with blocked network connections. The host remains responsible for essential exit, reconnect and billing UI. Host-message handling checks the frame source, nonce and declared action.

## Node host and adapters

Construct GenesisHost(sessionId,project,{storage,policy,services,providers}), then await initialize(). Methods: join, leave, view, action, playback, runJob, tick, retry and skip. diagnostics() is author-only and includes internal state. Never expose it to general participants.

Providers implement id, paid, capabilities, start, poll and optional cancel. Start receives a stable idempotencyKey, a job and anchor. Poll returns running, ready or failed. Ready scene results include videoUrl and an actual end-frame imageUrl. Storage implements load/save snapshots. The reference host serializes per-session operations in one process; distributed hosts provide their own transaction/lease adapter.

## Custom tools

Request namespaced capabilities such as tool.lookup in the manifest. The host must independently grant the capability and register a provider with that capability. Controllers emit `{id,type:"tool.request",toolId:"tool.lookup",data:{...}}`. Arguments and returned result.data are bounded to 12 KB. Provider validate(job) rejects invalid arguments before paid authorization. Completion enters job.ready with event.data.data. Generic tools preserve the stage; the controller decides presentation. No provider credential or unrestricted fetch capability enters the sandbox.

Collective submissions emit vote.cast with actorId and optionId. Controllers can inspect context.ballots to implement weights, quorum, early resolution or custom aggregation. Returning window:null closes the decision. The standard controller keeps deadline aggregation.

## Portable project boundary

The JSON Schema is exported as GENESIS_PROJECT_SCHEMA. `createGenesisProjectManifest` clears hosted package versions and saved-game connections without mutating the source definition. Inline source remains confined to transport projects. The Worldstreams editor preserves host references separately when applying manifest edits. `definition.interface.chat` optionally requests `{presentation:"minimized"|"open"|"disabled",reactions:boolean}`. Chat access and enforcement stay with the host. `extensions` uses namespaced keys such as `org.example`, up to 16 namespaces and 16 KB total. Unknown extension data is preserved without execution or capability grants.

## Participation version 1

For explicitly claimed seats, declare `definition.participation.seats` as `{version:1,slots:[{id,label}],queue:true,maxSeatsPerIdentity:1}`. Seats require multiplayer mode and spectators, with minPlayers no greater than the slot count and slots no greater than maxPlayers. Slot IDs are unique. Defaults are queue false and one seat per verified identity. Configure `room` as shared or private; room discovery is implemented by the hosting adapter. Sequencer defaults seat worlds to one shared public arena per published version. Continuous worlds always share their audience room. Ordinary projects without seats retain their admission behavior.

`Genesis.players.get()` and `subscribe(fn)` expose version, capabilities, seats with actorId/canClaim/canRelease, queueLength, own queuePosition/canQueue, and own cooldownUntil. `claim(seatId)`, `leave(seatId)`, `joinQueue()` and `leaveQueue()` request server transitions. A browser cannot specify another actor, a role, lease, identity, cooldown or removal authority. The host injects the verified identity. Sequencer requires sign-in to claim or queue. Watchers can remain anonymous.

Controller context.participation contains public seats and queueLength, with no identities or credentials. Events are seat.claimed, seat.released, queue.joined and queue.left. To release a defeated player, return `{id,type:"players.release",seatId,expectedActorId,cooldownMs:5000}`. Expected ownership is checked before commit; the cooldown is limited to 60 seconds and follows the identity across new actor IDs. Replacements are promoted atomically from the eligible FIFO queue. Actions still use ordinary window.actorIds and typed fields, keeping game-specific turns, teams and health in the controller.

Host methods `players(actorId,request)` and `read(actorId)` serialize and persist transitions. Host `join(actorId,name,role,identityKey)` must receive actorId and a stable identityKey from authenticated server middleware. The actor-ID fallback is for trusted local previews. The 45-second seat lease is renewed by read/action traffic at most every 15 seconds; a late heartbeat cannot revive an expired seat. Distributed hosts can use the exported participation reducers and requestGenesisPlayer inside their own transaction. Never expose host.join, diagnostics, identity registration, releaseGenesisSeat or controller dispatch as participant-controlled endpoints.

The arena starter demonstrates two seats, four moves, health, inventory, waiting spectators, defeat cooldown and replacement. Its animate setting defaults false for charge-free rule testing. Enable animate and configure a generation provider to render committed battle outcomes. Browser UI code stays in interface.html and game rules stay in controller.js.

## Structured LLM and asset helpers

Tool tool.llm.generate accepts `{prompt,context?,responseSchema}` with a bounded object schema. Completion emits job.ready with event.data.data. Effect guard `{key,value}` must match current server state before a result is applied; obsolete jobs emit job.cancelled without exposing their result. Controllers receive jobs metadata for scheduling, including status, type and guard.

Genesis.assets.get(path) resolves host-provided media sources. Portable bundles use declared assets/ paths; Sequencer interfaces use asset:// IDs after attachment. `importGenesisProjectBundle` preserves complete assetFiles; importGenesisProjectArchive returns only the project for compatibility.
