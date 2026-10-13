# Worldstream models and pricing

Pick a model for the experience you want to build. Native detail, scene continuity, response speed and billing rules all affect that choice.

## Published model comparison

<p class="comparison-hint">Scroll the table horizontally to compare all model details.</p>

<!-- WORLDSTREAM_MODEL_TABLE -->

These are published specifications and rates checked **October 13, 2026**. Hourly figures multiply a provider's rate by 3,600 billable seconds. They exclude your own app hosting, storage, LLM requests, taxes and any separately priced assets. Resolution and frame rate describe output format; they do not establish visual quality.

## Read the prices correctly

- **Sequencer:** Advertises $40 per active stream hour. The session quote is authoritative. Custom Genesis LLM requests and extra image/audio generation are separately metered. [Worldstreams API](https://sequencer.media/worldstream-api), [Genesis integration](integration.md).
- **fal H3 Max Director:** Bills generated video at $0.08 per second, with a 60-second minimum ($4.80). Public sessions currently have a 15-minute ceiling. [Director pricing and session limits](https://fal.ai/h3-max-director).
- **Reactor:** Bills wall-clock time while a session holds a GPU, including ready-but-idle time and recoverable disconnects. The three Reactor rates in the table also match its public pricing API at the check date. [Billing rules](https://docs.reactor.inc/resources/billing), [current pricing API](https://api.reactor.inc/pricing).

Orbis Stable has the lowest listed session rate in this comparison. A complete experience also needs state storage, user access, LLM logic and audience billing. Compare those responsibilities in the [setup options](index.html#choose-your-connection).

## Read the timing correctly

**Startup latency** is the time from requesting a session to seeing its first usable frame. **Response latency** is the time from sending an action to seeing its effect. **Generation speed** describes how quickly video is produced. **Chunk duration** describes when a streaming model can accept a new direction.

The timing column reports the measure each provider publishes. It is not a common end-to-end latency benchmark. Queuing, network delivery, buffering and your controller can change the wait a player experiences.

## Quality ratings

GENESIS uses a **1–5 rating** for each of five criteria. The overall quality score is their mean, shown to one decimal place. Speed and price are reported separately.

| Criterion | What to check |
| --- | --- |
| Visual detail | Clear subjects, readable environments and visible artifacts. |
| Prompt adherence | Whether the requested action, setting and constraints appear. |
| Character consistency | Whether identities, clothing and objects remain recognizable. |
| Scene continuity | Whether locations, spatial relationships and previous events carry forward. |
| Motion and stability | Natural movement, temporal consistency and recovery after a direction change. |

Use **1** for major failures, **2** for frequent failures, **3** for a usable result, **4** for a consistently strong result and **5** for a reliably excellent result across the test set.

Score at least ten shared scenarios, run each three times for two minutes, and publish the prompts, model/version, resolution, settings, date and recordings. Include the same character, inventory and scene-transition challenges for every model. Have at least two reviewers score recordings without provider labels.

**No matched GENESIS benchmark has been completed.** Every model is currently **unrated**, including Sequencer. A provider's demo or a clip-generation leaderboard does not establish its score for a persistent interactive world.

## Sources and model details

- [Sequencer Viva tutorial](https://sequencer.media/posts/tutorials/minimax-h3-realtime-worldstreams) and [Worldstreams API](https://sequencer.media/worldstream-api). Viva specifications follow Sequencer's published product material; available deployments and stream quotes can change.
- [fal H3 Max Director](https://fal.ai/h3-max-director). This is the streaming endpoint. The H3 Max image-to-video endpoint returns clips and has its own pricing.
- [Reactor MiniMax FastH3 specifications](https://www.reactor.inc/models/fast-h3/info). Its published 1× real-time generation rate describes throughput, not time to the first frame.
- [Reactor Orbis Stable specifications](https://www.reactor.inc/models/visko-orbis-stable/info). It generates 832 × 480 frames and upscales the delivered stream.
- [Reactor Orbis Dynamic specifications](https://www.reactor.inc/models/visko-orbis-dynamic/info). Its current model card lists 640 × 368 native frames. The shared [API overview](https://docs.reactor.inc/model-api-reference/visko-orbis-dynamic/overview) lists a different raster, so confirm the selected deployment's output before choosing it for resolution-sensitive work.

These provider options require a host adapter and a tested stream integration. Listing a model here does not mean the standalone Genesis preview already includes its live connector. [Connect your own providers](providers.md).
