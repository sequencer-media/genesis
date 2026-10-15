---
name: create-world-stream
description: Build or refine a playable Genesis world from a natural-language idea, including custom UI, shared game rules, structured LLM tools and portable media.
---

Turn the user's idea into a working world, a local preview and a validated exportable bundle. Choose mechanics, presentation and reasonable defaults from the prompt. Ask only for information that blocks the requested behavior. Preserve the user's chosen provider and existing world behavior. Sequencer is the default managed integration when a provider has not been chosen.

Read the package's README and docs/api.md. Use `genesis init` with the nearest template, then implement the requested world in genesis.json, interface.html and controller.js. Adapt the actual controls, rules and scene context to the idea. Use the local runner's labeled fixtures for an immediate preview; connect live generation when the provider is configured and spending is authorized.

For a solo game, start with `quest`. It has a complete objective, branching decisions, inventory, tactical choices, win/lose endings and replay. Replace its setting, story, visuals and rules to match the request. Make the first meaningful action available immediately. For multiplayer or model-specific requests, use the matching starter and preserve that requirement. Use `npm run play -- ./your-world` from the checkout to create or open a project and start its preview. New projects use quest unless a template is specified. The command installs and builds the local tools as needed.

Keep the local play loop fast. Free prepared media and LLM jobs run automatically in the reference preview. A new project version starts its own saved preview without deleting older progress. After edits, restart the preview command; the page reconnects. Test a full ending and replay, not just the first action. Keep setup and diagnostics outside the game UI, and give the user the preview URL plus two simple first-play instructions.

The stock local runner returns the arena move fixture for LLM requests. For a different responseSchema, supply matching fixture data through a local host provider using createLlmProvider; keep preview-only providers outside the portable project. Do not present a fixture response as live generation.

Use `window.Genesis` for browser actions, state subscriptions, seats and assets. Read actor eligibility from the accepted host view. Keep health, turn order, vote outcomes and permitted state transitions in synchronous `onEvent(context)`. Render LLM names as text; never evaluate model output as HTML or JavaScript.

For generated moves or world choices, request `tool.llm.generate` with a bounded object responseSchema, a cost ceiling and a guard against stale battle or scene IDs. Consume job.ready's event.data.data. Generate a move set once per encounter. Commit game outcomes before scene.request and wait for actual playback.completed before opening a visual turn. The arena-llm example covers four generated moves and player replacement.

Declare media under `assets/` with MIME type and byte size. Export a complete ZIP with `genesis export`. Use relative paths in portable files; attach them through the host adapter for production. Hosts copy immutable assets and provide runtime URLs. Keep credentials, wallets and prices outside project files.

For Sequencer, use a server-side SequencerClient with SEQUENCER_API_KEY. Read its model catalog and pricing before paid image, audio or video work. Pass a server-enforced maxCostUsd and a stable idempotencyKey to generate; read the resulting media through media(workspaceId, mediaId). Quote private streams for their chosen duration before starting. Save a version-checked draft with complete assets. Saving a draft does not start a stream or publish it. Supply your own authenticated server transport and monetization for custom deployments. For another provider, implement the provider contract and persistent result store described in docs/providers.md.

Run `genesis validate`, export the complete bundle and open an actual local preview. Exercise the changed custom control, repeat a turn, reject a wrong actor and stale action, and verify mobile layout. Run npm test when changing the runtime or provider contracts. Offline move/video fixtures demonstrate the protocol; describe them as fixtures. Deliver the project location, preview URL and bundle, or the saved draft when requested. Report any untested live-provider behavior. Publish only within the user's authorized scope.
