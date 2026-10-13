# Authoring Genesis projects

Read docs/api.md and the appropriate example before editing. Author settings in genesis.json with interfaceFile and controllerFile references. Keep browser code in interface.html and shared rules in controller.js. Archive exports include the three entry files, their JSON Schema and complete declared media. Transport JSON can inline both sources. Keep product records and host authority outside the manifest; unknown fields are rejected. Keep HTML/CSS/browser JavaScript separate from the synchronous server onEvent controller.

Use window.Genesis.action(actionId, data), actions.get(id).canSubmit, state.subscribe and stage.point in interface code. Declare each action and its typed fields. Controllers return public/private/server state, an eligible input window and effects. Asynchronous generation runs through host effects and returns job.ready or job.failed events.

Determine committed game outcomes before requesting a generated scene. Generation does not verify visual correctness. Open actions only for eligible actors and use challenge IDs for timing games. Use the actual end-frame anchor for exploration and the saved start anchor for repeatable challenges. Wait for playback.completed before advancing a visual turn.

Use definition.genesis.configSchema and config for project settings. Read values through context.config.settings. Stream defaults are authoring conveniences. Custom controllers can mix media operations supported by the host.

Never put secrets in the interface, controller, public state or project settings. Never define wallet prices, balances or billing clocks in project code. Host grants and verified purchases are external authority. Keep required exit and billing controls in the host UI. Browser animations stay local and never generate requests every frame.

Validate the project and test repeated cycles, wrong actors, stale actions, duplicate submissions, failures and private state. Respect responsive layouts, keyboard controls and reduced motion. Run npm test after changing runtime contracts.

For custom self-hosted services, use tool.request with a namespaced toolId and bounded data. Both manifest request and host grant are required. Register and validate the provider on the host. The Sequencer deployment currently grants scene.request, image.request, live.direction and tool.llm.generate.

For custom vote rules, handle vote.cast and read context.ballots. Implement quorum or weighted aggregation in the controller. Read verified benefits from host events; never accept a client-supplied payment or weight claim.

Use worldVideo.chunkIntervalSeconds for nominal continuous stream cadence, separate from scene.request.duration and vote deadlines. Respect the host supported intervals. Sequencer currently grants only 14 seconds for continuous streams.

Use coverImageUrl for listing art and startImageUrl for the initial scene. Hosted package version IDs and saved-game connections stay outside portable exports. Namespaced extensions are inert configuration and never grant access. The editor has three file tabs; starter selection and import/export are project menu actions.

For generated move sets, use tool.llm.generate with a bounded responseSchema, maxCostUsd and battleId guard. Render returned names as text. Keep damage and turn resolution in controller.js. The arena-llm template demonstrates this contract.
