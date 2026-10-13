# Integration

## Model routing

Use one server-side Sequencer key for Worldstreams, structured LLM tools and media generation. Sequencer holds upstream credentials and returns the stream connection details to your app.

**Available now:** Viva Worldstreams with built-in LLM world direction, plus separately metered structured LLM requests ($0.01/request by default) and image/audio/video generation.

**Planned routes:** H3 Max Director, Reactor FastH3 and Orbis. Their comparison prices use **provider cost × 1.15**, including a 15% Sequencer markup. These routes are estimates until their connectors, metering and live session quotes are available. Viva keeps its existing $40/hour retail price.

Start with the current [Worldstreams API](https://sequencer.media/worldstream-api) and use its returned quote. [Compare models and pricing](models.md).

## Publish your world on Sequencer

[Open My Worlds](https://sequencer.media/worldstreams#my-worlds) with your Sequencer account. Create a world and import your GENESIS project in the editor, or ask Spark to build it from a prompt. Preview the world, save it and publish it to Worldstreams. The hosted editor uses your existing identity, workspace, media library and gems.

The API workflow below uses a server-side key for creators building in their own tools. Browser imports use the existing signed-in session.

Use `createLlmProvider` with a `generate(request, context)` callback and a durable result store for paid calls. The request contains prompt, optional context and a bounded JSON responseSchema. The callback receives sessionId, a stable idempotencyKey and maxCostUsd. Keep the provider key on your server. The adapter validates output and sends it as job.ready's event.data.data. Paid providers must enforce the cost ceiling before submission. In-process deduplication does not replace distributed locks.

`createSequencerLlmProvider` connects that callback to the Sequencer LLM endpoint. `FileGenesisToolResults` is an atomic single-host store. Configure a transaction-backed result store for distributed workers. Keep the world generation adapter separate from the LLM adapter so either can be replaced. Image/audio/video generation uses SequencerClient.generate; enumerate supported models with models(), inspect model(modelId), pass a cost ceiling and retain the returned media/job ID. Read status and completed media through media(workspaceId, mediaId). A thumbnail is not an actual video end-frame checkpoint.

SequencerClient.save uploads declared assets and saves a guarded draft. load returns a portable project, complete assetFiles and the current versionId. The browser-compatible attachGenesisAssets helper supports signed-in creator imports without putting an account API key in the browser. Portable asset limits are 64 files, 50 MB/file and 100 MB total. The Sequencer adapter currently allows 40 files and 20 MB/file. Supported formats are PNG/JPEG/WebP/GIF, MP4/WebM, MP3/WAV/OGG.

Custom deployments authenticate their own audience, call server APIs using their account key and issue restricted viewer access. Hosted Worldstreams use Sequencer authentication and gems. A creator account key is never a public viewer token. Custom monetization, tips, subscriptions and voting payments remain creator decisions.

Private stream APIs use `/workspaces/{workspaceId}/live-worlds/{worldId}/streams/quote` and `streams/{uuid}/{start,heartbeat,prompt,stop}`. They currently support 30–600 seconds per session. Renew about every 10 seconds; the host stops a disconnected stream after its 60-second lease. A stream reserves its maximum USD cost, excludes startup and refunds unused credit once stopped. The current rate is $40/hour; always use the returned quote. Longer seamless sessions need a later provider/runtime capability and are not advertised as supported in this preview.

Call host.tick in one background worker per room. Start an authorized queued job with host.runJob, persist its provider handle, poll with bounded backoff, and pass accepted views to authenticated clients. Autorun decisions belong to the host's spending policy. Sequencer automatically runs its declared LLM tool against the hosting workspace owner's credit ($0.01/request by default); manual media generation uses the initiating authenticated account. Configured model rates and account limits remain server authority.

Use HTTPS stream tokens with minimum grants. A plain video URL supports prepared media; continuous providers need readiness, delivery, prompt updates, stop, lease renewal, playback acknowledgments and revocation when paid access ends. Model completion, prompt acceptance and actual playback are separate events.

Current hosted bounds are 100 Genesis participants and 250 paid viewer connections per stream. Multiple tabs for one account share a payer and cannot lower the pool's total cost. Larger deployments require a later host policy and metering implementation. Paid native Worldstreams require LiveKit Cloud participant revocation; Sequencer's configured transport supports this requirement. Self-hosted creators must supply equivalent access termination for their chosen transport.
