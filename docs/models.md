# Worldstream models and pricing

Pick a model for the experience you want to build. Native detail, scene continuity, response speed and billing rules all affect that choice.

## Worldstream model comparison

<p class="comparison-hint">Scroll the table horizontally to compare all model details.</p>

<!-- WORLDSTREAM_MODEL_TABLE -->

Model setup links lead to Sequencer. Provider specifications and prices were checked **October 13, 2026**. The provider column shows published costs. The Sequencer column applies **15% markup**, calculated as provider cost × 1.15, for planned third-party routes. Viva keeps its existing $40/hour retail rate.

Third-party routes are planned and their prices are estimates. Live quotes determine the actual rate when a connector becomes available. Hourly figures use 3,600 billable seconds and exclude app infrastructure, taxes and separately priced services. Resolution and frame rate describe output format; they do not establish visual quality.

## Read the prices correctly

- **Sequencer:** Advertises $40 per active stream hour. The session quote is authoritative. Viva includes built-in LLM world direction. Custom Genesis LLM requests and extra image/audio generation are separately metered. [Worldstreams API](https://sequencer.media/worldstream-api), [Genesis integration](integration.md).
- **fal H3 Max Director:** Bills generated video at $0.08 per second, with a 60-second minimum ($4.80). Public sessions currently have a 15-minute ceiling. [Director pricing and session limits](https://fal.ai/h3-max-director).
- **Reactor:** Bills wall-clock time while a session holds a GPU, including ready-but-idle time and recoverable disconnects. The three Reactor rates in the table also match its public pricing API at the check date. [Billing rules](https://docs.reactor.inc/resources/billing), [current pricing API](https://api.reactor.inc/pricing).

At the proposed 15% markup, Orbis Stable is about $40.16 per session hour. Viva is $40 per active stream hour, with built-in LLM direction. The billing clocks differ, so compare the session quote and your usage pattern. A complete experience also needs state storage, user access, LLM logic and audience billing. Compare those responsibilities in the [setup options](index.html#choose-your-connection).

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

## Low-latency LLMs

Viva LLM means the built-in direction service in a Viva Worldstream. It turns accepted world actions into video prompts and is included with the stream. Arbitrary structured calls through `tool.llm.generate` are a separate service, currently $0.01/request by default.

<p class="comparison-hint">Scroll the table horizontally to compare all LLM details.</p>

<!-- LLM_MODEL_TABLE -->

Token rates are **USD per one million input / output tokens** for standard text requests. Planned token-priced Sequencer routes use the same **15% markup**. The available structured LLM endpoint retains its current per-request rate. Caching, reasoning tokens, tools and provider minimums can affect the final quote.

### Latency and moderation

**First-token latency** measures the wait before the first token arrives. **Generation speed** measures tokens produced per second after generation begins. Structured JSON usually needs to finish and pass validation before GENESIS can apply it. None of the listed services has a matched GENESIS end-to-end latency benchmark.

The moderation column describes the controls we can verify. Google exposes adjustable filters alongside persistent core protections. Groq documents a separate moderation workflow. Open-weight models can have learned refusals, and hosted providers still apply their policies. A self-hosted app can choose whether to add a moderation layer; that does not remove refusals built into its chosen model.

- [Google Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Flash-Lite model details](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) support the token rates and low-latency design. [Safety settings](https://ai.google.dev/gemini-api/docs/safety-settings) describe adjustable filters and core protections.
- [Groq model catalog](https://console.groq.com/docs/models) lists GPT OSS 20B at $0.075 input / $0.30 output and about 1,000 tokens/second. [Content moderation](https://console.groq.com/docs/content-moderation) describes an app moderation workflow.
- [Cerebras pricing](https://www.cerebras.ai/pricing) lists GPT OSS 120B at $0.35 input / $0.75 output. Its [model catalog](https://inference-docs.cerebras.ai/models/overview) lists about 3,000 tokens/second. Model and capacity availability can change.

Provider speeds are published throughput claims, not measured GENESIS latency guarantees. [Connect through Sequencer](integration.md#model-routing) or [bring your own adapter](providers.md).

## Sources and model details

- [Sequencer Viva tutorial](https://sequencer.media/posts/tutorials/minimax-h3-realtime-worldstreams) and [Worldstreams API](https://sequencer.media/worldstream-api). Viva specifications follow Sequencer's published product material; available deployments and stream quotes can change.
- [fal H3 Max Director](https://fal.ai/h3-max-director). This is the streaming endpoint. The H3 Max image-to-video endpoint returns clips and has its own pricing.
- [Reactor MiniMax FastH3 specifications](https://www.reactor.inc/models/fast-h3/info). Its published 1× real-time generation rate describes throughput, not time to the first frame.
- [Reactor Orbis Stable specifications](https://www.reactor.inc/models/visko-orbis-stable/info). It generates 832 × 480 frames and upscales the delivered stream.
- [Reactor Orbis Dynamic specifications](https://www.reactor.inc/models/visko-orbis-dynamic/info). Its current model card lists 640 × 368 native frames. The shared [API overview](https://docs.reactor.inc/model-api-reference/visko-orbis-dynamic/overview) lists a different raster, so confirm the selected deployment's output before choosing it for resolution-sensitive work.

Sequencer routes need tested connectors, quotes and lifecycle metering before they become available. The standalone engine also supports your own adapters. [Sequencer model routing](integration.md#model-routing), [connect your own providers](providers.md).
