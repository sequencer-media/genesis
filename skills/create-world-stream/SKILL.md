---
name: create-world-stream
description: Create or refine a portable Genesis world with a custom interface, authoritative controller, structured LLM behavior and attached media.
---

Read the package's README and docs/api.md. Use `genesis init` with the nearest template, then edit genesis.json, interface.html and controller.js. Preserve the user's chosen provider and existing world behavior. Sequencer is the default managed integration when a provider has not been chosen.

Use `window.Genesis` for browser actions, state subscriptions, seats and assets. Read actor eligibility from the accepted host view. Keep health, turn order, vote outcomes and permitted state transitions in synchronous `onEvent(context)`. Render LLM names as text; never evaluate model output as HTML or JavaScript.

For generated moves or world choices, request `tool.llm.generate` with a bounded object responseSchema, a cost ceiling and a guard against stale battle or scene IDs. Consume job.ready's event.data.data. Generate a move set once per encounter. Commit game outcomes before scene.request and wait for actual playback.completed before opening a visual turn. The arena-llm example covers four generated moves and player replacement.

Declare media under `assets/` with MIME type and byte size. Export a complete ZIP with `genesis export`. Use relative paths in portable files; attach them through the host adapter for production. Hosts copy immutable assets and provide runtime URLs. Keep credentials, wallets and prices outside project files.

For Sequencer, use a server-side SequencerClient with SEQUENCER_API_KEY. Read its model catalog and pricing before paid image, audio or video work. Pass a server-enforced maxCostUsd and a stable idempotencyKey to generate; read the resulting media through media(workspaceId, mediaId). Quote private streams for their chosen duration before starting. Save a version-checked draft with complete assets. Saving a draft does not start a stream or publish it. Supply your own authenticated server transport and monetization for custom deployments. For another provider, implement the provider contract and persistent result store described in docs/providers.md.

Run `genesis validate`, `npm test`, and an actual local preview. Exercise the changed custom control, repeat a turn, reject a wrong actor and stale action, and verify mobile layout. Offline move/video fixtures demonstrate the protocol; describe them as fixtures. Report the actual draft or local result and any untested live-provider behavior. Publish only within the user's authorized scope.
